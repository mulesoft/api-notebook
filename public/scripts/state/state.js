var Backbone = require('backbone');
var messages = require('./messages');

/**
 * Extendable implementation of application state data. State can listen to the
 * global messaging object, but it should never listen the other way around.
 *
 * @type {Object}
 */
var state = module.exports = new (Backbone.Model.extend())();

var updateScrollDimensions = function () {
  state.set('window.scrollWidth',  document.documentElement.scrollWidth);
  state.set('window.scrollHeight', document.documentElement.scrollHeight);
};

var updateWindowDimensions = function () {
  var width  = window.innerWidth || Math.max(document.body.offsetWidth,
    document.documentElement.offsetWidth);
  var height = window.innerHeight || Math.max(document.body.offsetHeight,
    document.documentElement.offsetHeight);

  state.set('window.width',  width);
  state.set('window.height', height);

  updateScrollDimensions();
};

updateWindowDimensions();
state.listenTo(messages, 'resize', updateScrollDimensions);
state.listenTo(messages, 'window:resize', updateWindowDimensions);

state.listenTo(messages, 'keydown:Alt-Alt', function () {
  state.set('showExtra', true);
});

state.listenTo(messages, 'keyup:Alt', function () {
  state.set('showExtra', false);
});
