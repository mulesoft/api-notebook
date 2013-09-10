var _        = require('underscore');
var Backbone = require('backbone');

/**
 * Very simple implementation of a message bus that can be used anywhere within
 * the application.
 *
 * @type {Object}
 */
var messages = module.exports = _.extend({}, Backbone.Events);

messages.listenTo(Backbone.$(window), 'resize', _.throttle(function () {
  messages.trigger('window:resize');
}, 100));

// Push any keyboard events into the global messages object, avoids listening
// multiple times to the document. Augments the event name to match the key
// map in human terms.
messages.listenTo(Backbone.$(document), 'keydown', function (e) {
  messages.trigger('keydown', CodeMirror.keyName(e, e.which === 16));
  messages.trigger('keydown:' + CodeMirror.keyName(e, e.which === 16));
});

messages.listenTo(Backbone.$(document), 'keyup', function (e) {
  messages.trigger('keyup', CodeMirror.keyName(e));
  messages.trigger('keyup:' + CodeMirror.keyName(e));
});
