/*
  TODO:
  - Rename to cell-controls
  - Switch mode button should change label to "Swith to Text" /
    "Switch to Code" deopending on current mode.
*/

var Backbone          = require('backbone');
var View              = require('../view');
var CellControlsModel = require('../../models/cell-controls');

var ControlsView = module.exports = View.extend({
  className: 'cell-controls',
  events: {
    "click": "onClick"
  }
});

/**
 * Creates a new ControlsView. Takes an editorCell instance to control.
 *
 * @param {EditorCell} EditorCell  Instance of editorCell to control.
 */
ControlsView.prototype.initialize = function () {
  this.model = this.model || new CellControlsModel();
};

/**
 * Toggles the control to be appended or removed from a view. If the control
 * is already appended to the passed in view, it is simply removed from the
 * view; otherwise the control is appended to the view.
 *
 * @param {View} view  The view to append to or remove from.
 */
ControlsView.prototype.toggleView = function (view) {
  var toggleOn = (this.editorView !== view);

  if (this.editorView) {
    this.remove();
  }

  if (toggleOn) {
    this.editorView = view;
    this.delegateEvents(ControlsView.prototype.events);
    this.appendTo(view.el);
  }
};

ControlsView.prototype.remove = function () {
  this.editorView = null;
  View.prototype.remove.call(this);
};

ControlsView.prototype.render = function () {
  var actionElStr;
  var self = this;
  this.model.actions.forEach(function (action) {
    // TODO move action to a data-attrib
    actionElStr = '<button class="action-' + action.name + '">' +
    action.label + '<span>' + action.keyCode + '</span></button>';
    // Parse HTML to DOM element and append to this view.
    self.el.appendChild(Backbone.$(actionElStr)[0]);
  });
  return this;
};

/**
 * Event handler for clicks on control buttons. Pass thru for clicks on the
 * parent element.
 * @param {object} event  The normalized event object.
 */
ControlsView.prototype.onClick = function (event) {
  // Prevent clicks outside an action item; and orphaned clicks.
  if (event.target === this.el || !this.editorView) {
    return false;
  }

  var action = event.target.className.replace(/action-/, '');
  var editorView = this.editorView;
  var viewFn = editorView[action];

  if (typeof viewFn === 'function') {
    viewFn.call(editorView);
  }

  this.remove();
};
