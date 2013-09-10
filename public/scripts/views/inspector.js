var _          = require('underscore');
var View       = require('./view');
var domify     = require('domify');
var Backbone   = require('backbone');
var stringify  = require('../lib/stringify');
var state      = require('../state/state');
var messages   = require('../state/messages');
var middleware = require('../state/middleware');

var InspectorView = module.exports = View.extend({
  className: 'inspector'
});

InspectorView.prototype.initialize = function (options) {
  _.extend(this, _.pick(
    options, ['property', 'parent', 'inspect', 'internal']
  ));

  if (this.parent) {
    this.listenTo(this.parent, 'close', this.close);
  }
};

var stopEvent = function (e) {
  e.preventDefault();
  e.stopPropagation();
};

InspectorView.prototype.events = {
  'mouseup':   stopEvent,
  'mousedown': stopEvent,
  'click': function (e) {
    stopEvent(e);
    this.toggle();
  }
};

InspectorView.prototype.open = function () {
  this.trigger('open', this);
  this.el.classList.add('open');
  messages.trigger('resize');
};

InspectorView.prototype.close = function () {
  this.trigger('close', this);
  this.el.classList.remove('open');
  messages.trigger('resize');
};

InspectorView.prototype.toggle = function () {
  this[this.el.classList.contains('open') ? 'close' : 'open']();
};

InspectorView.prototype.shouldExpand = function () {
  return _.isObject(this.inspect);
};

InspectorView.prototype.stringifyPreview = function () {
  return stringify(this.inspect);
};

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

InspectorView.prototype.renderChildren = function () {
  if (!this.shouldExpand(this.inspect)) { return this; }

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

InspectorView.prototype._renderChildrenEl = function () {
  var el = this.childrenEl = domify('<div class="children"></div>');
  this.el.appendChild(el);
  this.children = [];
  return this;
};

InspectorView.prototype._renderChildren = function () {
  _.each(Object.getOwnPropertyNames(this.inspect), function (prop) {
    var descriptor = Object.getOwnPropertyDescriptor(this.inspect, prop);

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

InspectorView.prototype.renderPreview = function () {
  var html    = '';
  var prefix  = '';
  var special = !!this.internal;
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
  html += '<span class="inspect">';
  html += _.escape(this.stringifyPreview());
  html += '</span>';
  html += '</div>';

  var el = this.previewEl = domify(html);

  // Run filter middleware to check if the property should be filtered from
  // the basic display.
  middleware.trigger('inspector:filter', {
    filter:     true,
    parent:     parent,
    property:   this.property,
    internal:   this.internal,
    descriptor: desc
  }, _.bind(function (err, data) {
    this.el.appendChild(el);

    var toggleExtra = _.bind(function (toggle) {
      this.el.classList[toggle ? 'remove' : 'add']('hide');
    }, this);

    if (!data.filter) {
      // Listen for state changes to show extra properties/information
      toggleExtra(state.get('showExtra'));
      this.listenTo(state, 'change:showExtra', function (_, toggle) {
        toggleExtra(toggle);
      });
    }
  }, this));


  return this;
};

InspectorView.prototype.render = function (onDemand) {
  View.prototype.render.call(this);
  this.renderPreview();
  this.renderChildren();
  return this;
};
