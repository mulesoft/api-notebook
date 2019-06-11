var DOMBars  = require('dombars/runtime');
var Backbone = require('backbone');
var messages = require('./messages');

/**
 * Extendable implementation of application state data. State can listen to the
 * global messaging object, but it should never listen the other way around.
 *
 * @type {Object}
 */
var state = module.exports = new Backbone.Model();

/**
 * Keep track of the previous execution.
 */
var execTimeout = null;

/**
 * Listen to resize events through the messages and update the current state.
 */
state.listenTo(messages, 'resize refresh', function () {
  if (execTimeout) {
    return;
  }

  /**
   * Should be most performant to utilize the render loop.
   */
  execTimeout = DOMBars.VM.exec(function () {
    execTimeout = null;

    var docEl = document.documentElement;

    state.set('viewportWidth',  window.innerWidth);
    state.set('viewportHeight', window.innerHeight);
    state.set('documentWidth',  docEl.scrollWidth);
    state.set('documentHeight', docEl.scrollHeight);
  });
});
