var _          = require('underscore');
var View       = require('./template');
var template   = require('../../templates/views/cell-controls.hbs');
var middleware = require('../state/middleware');
var domListen  = require('../lib/dom-listen');

/**
 * Displays the cell controls overlay menu.
 *
 * @type {Function}
 */
var ControlsView = module.exports = View.extend({
  className: 'cell-controls',
  events: {
    'mousedown .action':  'onClick',
    'touchstart .action': 'onClick'
  }
});

/**
 * Controls view template.
 *
 * @type {Function}
 */
ControlsView.prototype.template = template;

/**
 * Render the controls overlay.
 *
 * @param  {Array}        controls
 * @return {ControlsView}
 */
ControlsView.prototype.render = function (controls) {
  // Set the controls to be rendered in the template.
  this.data.set('controls', controls || []);

  View.prototype.render.call(this);

  // Any events on the document view should cause focus to be lost.
  this.listenTo(domListen(document), 'mousedown',  this.remove);
  this.listenTo(domListen(document), 'touchstart', this.remove);

  var keydownMiddleware = middleware.register(
    'keydown:Esc', _.bind(function (event, next, done) {
      this.remove();
      return done();
    }, this)
  );

  this.listenTo(this, 'remove', function () {
    middleware.deregister('keydown:Esc', keydownMiddleware);
  });

  return this;
};

/**
 * Event handler for clicks on control buttons. Pass thru for clicks on the
 * parent element.
 *
 * @param {object} e The normalized event object.
 */
ControlsView.prototype.onClick = function (e) {
  var node = e.target;

  while (!node.hasAttribute('data-action')) {
    node = node.parentNode;
  }

  this.trigger('action', this, node.getAttribute('data-action'));
  return this.remove();
};
