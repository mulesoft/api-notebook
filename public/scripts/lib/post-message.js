var _      = require('underscore');
var Events = require('backbone').Events;
var Kamino = require('kamino');

/**
 * Set up event messaging with an external frame.
 *
 * @param  {Object} parentFrame
 * @return {PostMessage}
 */
var PostMessage = module.exports = function (parentFrame) {
  if (!('postMessage' in parentFrame)) {
    throw new Error('Need an instance of another frame to communicate.');
  }

  this.parentFrame = parentFrame;

  global.addEventListener('message', _.bind(function (e) {
    if (e.source !== parentFrame) { return; }

    if (this.origin && this.origin !== 'null') {
      this.origin = e.origin;
    }

    this._frameEvent = e;
    // Messages being passed by the parent window should always be in an array
    this.trigger.apply(this, Kamino.parse(e.data));
  }, this), false);
};

_.extend(PostMessage.prototype, Events);

/**
 * Trigger an event on the through the frame.
 *
 * @param  {String} name
 * @param  {*}      ...
 * @return {PostMessage}
 */
PostMessage.prototype.trigger = function (/* name , ...args */) {
  // If we have a frame event, use `trigger` normally and trigger the event
  // for local event listeners.
  if (this._frameEvent) {
    delete this._frameEvent;
    return Events.trigger.apply(this, arguments);
  }

  this.parentFrame.postMessage(
    Kamino.stringify(_.toArray(arguments)),
    this.origin || '*'
  );

  return this;
};
