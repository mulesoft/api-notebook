var _          = require('underscore');
var middleware = require('../state/middleware');

var Sandbox = module.exports = function () {
  this.createFrame();
};

Sandbox.prototype.createFrame = function () {
  this.frame = document.createElement('iframe');
  this.frame.style.display = 'none';
  document.body.appendChild(this.frame);
  this.window = this.frame.contentWindow;
};

Sandbox.prototype.execute = function (code, done) {
  var global = this.window;

  middleware.trigger('sandbox:context', {}, function (err, context) {
    // Provides additional context under the `console` object. This works in the
    // same fashion as how Chrome's console is implemented, and has the benefit
    // of any context variables not wiping out `window` variables (they will
    // just be shadowed with `with`).
    global.console = global.console || {};
    global.console._notebookApi = context;

    // Allows middleware to hook into the execution event.
    middleware.trigger('sandbox:execute', {
      code:    code,
      context: context,
      window:  global
    }, function (err, exec) {
      delete global.console._notebookApi;
      return done && done(err, exec);
    });
  });
};

Sandbox.prototype.remove = function () {
  this.frame.parentNode.removeChild(this.frame);
  delete this.frame;
  delete this.window;
};
