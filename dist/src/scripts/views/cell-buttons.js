var _         = require('underscore');
var View      = require('./template');
var template  = require('../../templates/views/cell-buttons.hbs');
var domListen = require('../lib/dom-listen');

/**
 * Displays the cell controls overlay menu.
 *
 * @type {Function}
 */
var ButtonsView = module.exports = View.extend({
  className: 'cell-buttons',
  events: {
    'click .action': 'onClick'
  }
});

/**
 * Keep an array of controls to display.
 *
 * @type {Array}
 */
ButtonsView.controls = [];

/**
 * Initialize the buttons view.
 */
ButtonsView.prototype.initialize = function () {
  this.listenTo(domListen(document), 'mousemove', _.throttle(function (e) {
    // Avoid removing the buttons when moving the mouse inside itself.
    if (this.el.contains(e.target)) {
      return;
    }

    return this.hide();
  }, 10));

  return View.prototype.initialize.call(this);
};

/**
 * Hide the buttons.
 */
ButtonsView.prototype.hide = function () {
  this.el.classList.remove('show-buttons');
};

/**
 * Show the buttons.
 */
ButtonsView.prototype.show = function () {
  this.el.classList.add('show-buttons');
};

/**
 * Require the buttons template.
 *
 * @type {Function}
 */
ButtonsView.prototype.template = template;

/**
 * Event handler for clicks on control buttons. Pass thru for clicks on the
 * parent element.
 *
 * @param {object} e The normalized event object.
 */
ButtonsView.prototype.onClick = function (e) {
  e.preventDefault();

  this.hide();
  this.trigger('action', this, e.target.getAttribute('data-action'));
};

/**
 * Push some initial controls into the view.
 */
ButtonsView.controls.push({
  label: 'Insert Text Cell',
  command: 'newText'
}, {
  label: 'Insert Code Cell',
  command: 'newCode'
});
