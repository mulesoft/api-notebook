var _ = require('underscore');

var Sandbox = module.exports = function () {
  this.createFrame();
};

Sandbox.prototype.createFrame = function () {
  this.frame = document.createElement('iframe');
  this.frame.style.display = 'none';
  document.body.appendChild(this.frame);
  this.window = this.frame.contentWindow;
};

Sandbox.prototype.execute = function (code, context, cb) {
  // Using an asynchronous callback to clear the any possible stack trace
  // that would include implementation logic
  (global.requestAnimationFrame || global.setTimeout)(_.bind(function () {
    var isError = false;
    var result, err;

    try {
      if (typeof context === 'object') {
        this.window.console = this.window.console || {};
        this.window.console._notebookAPI = context;
        code = 'with (window.console._notebookAPI) {\n' + code + '\n}';
      }

      /* jshint evil: true */
      result = this.window.eval(code);
    } catch (error) {
      err     = error;
      isError = true;
    } finally {
      delete this.window.console._notebookAPI;
      cb(isError ? err : result, isError);
    }
  }, this), 0);
};

Sandbox.prototype.remove = function () {
  this.frame.parentNode.removeChild(this.frame);
  delete this.frame;
  delete this.window;
};
