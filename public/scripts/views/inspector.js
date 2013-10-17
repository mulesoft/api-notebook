var _          = require('underscore');
var View       = require('./view');
var domify     = require('domify');
var Backbone   = require('backbone');
var stringify  = require('../lib/stringify');
var state      = require('../state/state');
var messages   = require('../state/messages');
var middleware = require('../state/middleware');

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
  _.extend(this, _.pick(
    options, ['property', 'parent', 'inspect', 'internal']
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
    inspect:  inspect,
    property: property,
    internal: internal
  });
  this.children.push(inspector);
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

  // If it should be expanded, add a class to show it can be. In no case should
  // we expand an error to show more though, since it should be displaying a
  // stack trace
  this.el.classList.add('can-expand');

  this.listenTo(this, 'open', this._renderChildren);

  this.listenTo(this, 'close', function () {
    _.each(this.children, function (child) {
      child.remove();
    });

    this.children = [];
  });

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
  this.children = [];
  return this;
};

/**
 * Render all child properties of the currently inspected object.
 *
 * @return {InspectorView}
 */
InspectorView.prototype._renderChildren = function () {
  // Convert to an object to remove duplicate property names. Chrome has a
  // pretty major bug where all `document` keys are returned twice.
  var propertyNames = _.keys(_.object(
    Object.getOwnPropertyNames(this.inspect), true
  )).sort();

  _.each(propertyNames, function (prop) {
    var descriptor = Object.getOwnPropertyDescriptor(this.inspect, prop);

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

  // Hidden prototype - super handy when debugging
  this._renderChild(null, Object.getPrototypeOf(this.inspect), '[[Prototype]]');

  return this;
};

/**
 * Render the inspector preview.
 *
 * @return {InspectorView}
 */
InspectorView.prototype.renderPreview = function () {
  var html    = '';
  var prefix  = '';
  var special = !!this.internal;
  var preview = this.stringifyPreview();
  var parent  = this.parent && this.parent.inspect;
  var desc;

  // If we have a property name, use it as the display prefix.
  if (this.property) { prefix = this.property; }

  // If we have a parent object, do some more advanced checks to establish some
  // more advanced properties such as the prefix and special display.
  if (parent) {
    if (this.internal) {
      // Internal properties are always special.
      special = true;
      // Getters and getters still have a descriptor available.
      if (this.internal === '[[Getter]]' || this.internal === '[[Setter]]') {
        if (this.internal === '[[Getter]]') {
          prefix = 'get ' + this.property;
        } else {
          prefix = 'set ' + this.property;
        }
        desc = Object.getOwnPropertyDescriptor(parent, this.property);
      // No other internal object property types can get a descriptive text, so
      // we'll just use the internal property name as the prefix.
      } else {
        prefix = this.internal;
      }
    } else {
      desc    = Object.getOwnPropertyDescriptor(parent, this.property);
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
  html += '<span class="inspect" title="' + _.escape(preview) + '">';
  html += _.escape(preview.split('\n').join('↵'));
  html += '</span>';
  html += '</div>';

  var el = this.previewEl = domify(html);

  // Run filter middleware to check if the property should be filtered from
  // the basic display.
  middleware.trigger('inspector:filter', {
    parent:     parent,
    property:   this.property,
    internal:   this.internal,
    descriptor: desc
  }, _.bind(function (err, filter) {
    this.el.appendChild(el);

    var toggleExtra = _.bind(function (toggle) {
      this.el.classList[toggle ? 'remove' : 'add']('hide');
    }, this);

    if (!filter) {
      // Listen for state changes to show extra properties/information
      toggleExtra(state.get('showExtra'));
      this.listenTo(state, 'change:showExtra', function (_, toggle) {
        toggleExtra(toggle);
      });
    }
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
