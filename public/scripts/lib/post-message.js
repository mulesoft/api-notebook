var _      = require('underscore');
var Events = require('backbone').Events;

/**
 * Set up a communication protocol with an external frame.
 *
 * @param  {Object} parentFrame
 * @return {Messages}
 */
var Messages = module.exports = function (parentFrame) {
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
    this.trigger.apply(this, e.data);
  }, this), false);
};

_.extend(Messages.prototype, Events);

Messages.prototype.trigger = function (name /*, ...args */) {
  if (this._frameEvent) {
    delete this._frameEvent;
    return Events.trigger.apply(this, arguments);
  }

  this.parentFrame.postMessage(
    Array.prototype.slice.call(arguments, 0),
    this.origin || '*'
  );

  return this;
};
