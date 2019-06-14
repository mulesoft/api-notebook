var _          = require('underscore');
var View       = require('./view');
var domify     = require('domify');
var stringify  = require('../lib/stringify');
var messages   = require('../state/messages');
var middleware = require('../state/middleware');

/**
 * Match anything that looks like a valid uri. This includes "data:", "mailto:",
 * "http://", "https://", "ftp://" and anything else that may exist.
 */
var linkRegExp = new RegExp(
  '(' +
    '(?:\\w+:\\/{2}|(?:data|mailto)\\:)' +
    '(?:' +
      '[A-Za-z0-9\\.\\-_~:/\\?#\\[\\]@!\\$&\'\\(\\)\\*\\+,;=]|%[A-Fa-f0-9]{2}' +
    ')+' +
  ')',
  'g'
);

/**
 * Creates a new inspector view instance.
 *
 * @type {Function}
 */
var InspectorView = module.exports = View.extend({
  className: 'inspector'
});

/**
 * Runs when a new instector instance is created.
 *
 * @param  {Object} options
 */
InspectorView.prototype.initialize = function (options) {
  View.prototype.initialize.apply(this, arguments);

  _.extend(this, _.pick(
    options, ['property', 'parent', 'inspect', 'internal', 'window']
  ));

  if (this.parent) {
    this.listenTo(this.parent, 'close', this.close);
  }
};

/**
 * Listen to events in the view and stop them from propagating (since parent
 * inspector views are listening to the same events).
 *
 * @type {Object}
 */
InspectorView.prototype.events = {
  'click': function (e) {
    e.stopPropagation();
    this.toggle();
  }
};

/**
 * Open the inspector to view the children.
 */
InspectorView.prototype.open = function () {
  this.trigger('open', this);
  this.el.classList.add('open');
  messages.trigger('resize');
};

/**
 * Closes the inspector instance and hides the children.
 */
InspectorView.prototype.close = function () {
  this.trigger('close', this);
  this.el.classList.remove('open');
  messages.trigger('resize');
};

/**
 * Toggle the display of children.
 */
InspectorView.prototype.toggle = function () {
  this[this.el.classList.contains('open') ? 'close' : 'open']();
};

/**
 * Returns whether the inspector is actually expandable.
 *
 * @return {Boolean}
 */
InspectorView.prototype.isExpandable = function () {
  return _.isObject(this.inspect);
};

/**
 * Stringifies the inspected object for display.
 *
 * @return {String}
 */
InspectorView.prototype.stringifyPreview = function () {
  // If we have a parent object, render in the simplified format. Except for
  // functions, we still want the full output for functions.
  if (this.parent) {
    // PhantomJS reports `NodeList` instances to be functions.
    if (Object.prototype.toString.call(this.inspect) === '[object Function]') {
      return this.inspect.toString();
    } else {
      return stringify.stringifyChild(this.inspect);
    }
  }

  return stringify(this.inspect);
};

/**
 * Render a child property view. Passes through all sorts of properties to help
 * with rendering.
 *
 * @param  {String} property Inspected property name.
 * @param  {*}      inspect  The object to inspect.
 * @param  {String} internal A string representing the internal property.
 * @return {InspectorView}
 */
InspectorView.prototype._renderChild = function (property, inspect, internal) {
  var inspector = new InspectorView({
    parent:   this,
    window:   this.window,
    inspect:  inspect,
    property: property,
    internal: internal
  });
  this.children[inspector.cid] = inspector;
  inspector.render().appendTo(this.childrenEl);

  return this;
};

/**
 * Render all child properties.
 *
 * @return {InspectorView}
 */
InspectorView.prototype.renderChildren = function () {
  // The element may not even be expandable. In which case, we can safely return
  // early before doing any rendering.
  if (!this.isExpandable(this.inspect)) { return this; }

  this._renderChildrenEl();

  // If it should be expanded, add a class to show it can be.
  this.el.classList.add('can-expand');

  this.listenTo(this, 'open',  this._renderChildren);
  this.listenTo(this, 'close', this._removeChildren);

  return this;
};

/**
 * Render the children element container.
 *
 * @return {InspectorView}
 */
InspectorView.prototype._renderChildrenEl = function () {
  var el = this.childrenEl = domify('<div class="children"></div>');
  this.el.appendChild(el);
  this.children = {};
  return this;
};

/**
 * Render all child properties of the currently inspected object.
 *
 * @return {InspectorView}
 */
InspectorView.prototype._renderChildren = function () {
  // We need to use the `Object.*` functions from the correct window object.
  // Firefox 26 returns `undefined` as the value for an arrays length property
  // when accessed using the wrong frames `Object.getOwnPropertyDescriptor`.
  var getPrototypeOf           = this.window.Object.getPrototypeOf;
  var getOwnPropertyNames      = this.window.Object.getOwnPropertyNames;
  var getOwnPropertyDescriptor = this.window.Object.getOwnPropertyDescriptor;
  var allPropertyNames;

  // Wrap getting property names in a `try..catch` since the inspected object
  // is unknown. We also need to get only unique property names since Chrome
  // has a pretty major bug where all `document` keys are returned twice.
  try {
    allPropertyNames = _.uniq(getOwnPropertyNames(this.inspect));
  } catch (e) {
    return this;
  }

  // We want to sort the keys numerically, and then alphabetically.
  var propertyNames = allPropertyNames.sort(function (a, b) {
    var aNum = parseInt(a, 10);
    var bNum = parseInt(b, 10);

    // Order two numbers by their values.
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }

    // Numbers should always come out on top.
    if (!isNaN(aNum)) {
      return -1;
    }

    if (!isNaN(bNum)) {
      return 1;
    }

    // Strings can be sorted like usual.
    return a > b ? 1 : -1;
  });

  _.each(propertyNames, function (prop) {
    var descriptor;

    // Wrap the collection and checking of property names in a `try..catch`
    // statement since the origin of the object is unknown. For example,
    // attempting to check `window.parent` cross-domain will throw an error.
    try {
      descriptor = getOwnPropertyDescriptor(this.inspect, prop);
    } catch (e) {}

    // Even though we are iterating over our own property names, PhantomJS is
    // finding a way to return an `undefined` property descriptor.
    if (_.isUndefined(descriptor)) { return; }

    // Check for the existence of getters and setters, otherwise it's a regular
    // property.
    if (_.isFunction(descriptor.get) || _.isFunction(descriptor.set)) {
      if (_.isFunction(descriptor.get)) {
        this._renderChild(prop, descriptor.get, '[[Getter]]');
      }

      if (_.isFunction(descriptor.set)) {
        this._renderChild(prop, descriptor.set, '[[Setter]]');
      }
    } else {
      this._renderChild(prop, descriptor.value);
    }
  }, this);

  // Render the internal prototype property.
  this._renderChild(null, getPrototypeOf(this.inspect), '[[Prototype]]');

  return this;
};

/**
 * Remove all the currently rendered children.
 *
 * @return {InspectorView}
 */
InspectorView.prototype._removeChildren = function () {
  _.each(this.children, function (child) {
    child.remove();
  });

  return this;
};

/**
 * Render the inspector preview.
 *
 * @return {InspectorView}
 */
InspectorView.prototype.renderPreview = function () {
  var parent = this.parent && this.parent.inspect;
  var desc;

  if (parent && !this.internal) {
    desc = this.window.Object.getOwnPropertyDescriptor(parent, this.property);
  }

  // Run filter middleware to check if the property should be filtered from
  // the basic display.
  middleware.trigger('inspector:filter', {
    parent:     parent,
    window:     this.window,
    property:   this.property,
    internal:   this.internal,
    descriptor: desc
  }, _.bind(function (err, filter) {
    if (!filter) { return this.remove(); }

    var html        = '';
    var prefix      = '';
    var special     = !!this.internal;
    var preview     = this.stringifyPreview(this.inspect);
    var htmlPreview = '';

    if (typeof this.inspect === 'string') {
      var previous = 0;

      preview.replace(linkRegExp, function (match, uri, index) {
        var escapedUri = _.escape(uri);

        // Append the html preview in multiple steps.
        htmlPreview += _.escape(preview.slice(previous, index));
        htmlPreview += '<a href="' + escapedUri + '" target="_blank">';
        htmlPreview += escapedUri;
        htmlPreview += '</a>';

        // Increment the previous marker to the current position.
        previous = index + match.length;
      });

      htmlPreview += _.escape(preview.substr(previous));
    } else {
      htmlPreview = _.escape(preview);
    }

    // If we have a property name, use it as the display prefix.
    if (this.property) {
      prefix = this.property;
    }

    // If we have a parent object, do some more advanced checks to establish
    // some more advanced properties such as the prefix and special display.
    if (parent) {
      if (this.internal) {
        // Internal properties are always specially rendered properties.
        special = true;

        // Setters and getters still should still be rendered with their
        // property names. Everything else can just be rendered using the
        // internal property notation.
        if (this.internal === '[[Getter]]') {
          prefix = 'get ' + this.property;
        } else if (this.internal === '[[Setter]]') {
          prefix = 'set ' + this.property;
        } else {
          prefix = this.internal;
        }
      } else {
        special = !desc.writable || !desc.configurable || !desc.enumerable;
      }
    }

    html += '<div class="arrow"></div>';
    html += '<div class="preview">';
    if (prefix) {
      html += '<span class="property' + (special ? ' is-special' : '') + '">';
      html += _.escape('' + prefix);
      html += '</span>: ';
    }
    html += '<p class="inspect" title="' + _.escape(preview) + '">';
    html += htmlPreview.split('\n').join('↵');
    html += '</p>';
    html += '</div>';

    this.el.appendChild(this.previewEl = domify(html));
  }, this));

  return this;
};

/**
 * Renders the inspector view.
 *
 * @return {InspectorView}
 */
InspectorView.prototype.render = function () {
  View.prototype.render.call(this);
  this.renderPreview();
  this.renderChildren();

  return this;
};

/**
 * Remove the inspector from the current view. Also removes itself from its
 * parent inspector view.
 */
InspectorView.prototype.remove = function () {
  if (this.parent) {
    delete this.parent.children[this.cid];
  }

  return View.prototype.remove.call(this);
};
