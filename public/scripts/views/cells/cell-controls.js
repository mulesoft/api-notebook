var _        = require('underscore');
var domify   = require('domify');
var Backbone = require('backbone');
var View     = require('../view');
var controls = require('../../lib/controls').editor;

var ControlsView = module.exports = View.extend({
  className: 'cell-controls',
  events: {
    'mousedown': function (e) { e.stopPropagation(); },
    'click .action': 'onClick'
  }
});

/**
 * Toggles the control to be appended or removed from a view. If the control
 * is already appended to the passed in view, it is simply removed from the
 * view; otherwise the control is appended to the view.
 *
 * @param {View} view  The view to append to or remove from.
 */
ControlsView.prototype.toggleView = function (view) {
  var toggleOn = (this.editorView !== view);

  this.detach();

  if (toggleOn) {
    this.editorView = view;
    this.appendTo(view.el);
  }

  this.delegateEvents(ControlsView.prototype.events);
};

ControlsView.prototype.detach = function () {
  if (this.editorView) {
    this.el.parentNode.removeChild(this.el);
  }
  delete this.editorView;
};

ControlsView.prototype.render = function () {
  var only = ['moveUp', 'moveDown', 'switch', 'clone', 'remove', 'appendNew'];

  var html = _.map(controls, function (action) {
    // Some items are currently being hidden from the controls menu
    if (!_.contains(only, action.command)) { return ''; }

    var button = '<button class="action" data-action="' + action.command + '">';
    button += action.label + '<span>' + action.keyCode + '</span></button>';
    return button;
  }).join('\n');
  this.el.appendChild(domify(html));

  var onBlur = _.bind(this.detach, this);
  this.listenTo(Backbone.$(document), 'mousedown',  onBlur);
  this.listenTo(Backbone.$(document), 'touchstart', onBlur);

  this.listenTo(Backbone.$(document), 'keydown', _.bind(function (e) {
    var ESC = 27;

    if (e.which === ESC) {
      return this.detach();
    }
  }, this));

  return this;
};

/**
 * Event handler for clicks on control buttons. Pass thru for clicks on the
 * parent element.
 * @param {object} e The normalized event object.
 */
ControlsView.prototype.onClick = function (e) {
  var action     = e.target.getAttribute('data-action');
  var editorView = this.editorView;
  var viewFn     = editorView[action];

  if (typeof viewFn === 'function') {
    viewFn.call(editorView);
  }

  this.detach();
};
