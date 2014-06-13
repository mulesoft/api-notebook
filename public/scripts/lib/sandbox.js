var middleware = require('../state/middleware');

/**
 * Creates a sandbox instance for executing arbitrary code.
 *
 * @return {Sandbox}
 */
var Sandbox = module.exports = function () {
  this.frame = document.createElement('iframe');
  this.frame.style.display = 'none';
  document.body.appendChild(this.frame);
  this.window = this.frame.contentWindow;
};

/**
 * Execute code in the sandbox environment.
 *
 * @param  {String}   code
 * @param  {Function} done
 */
Sandbox.prototype.execute = function (code, done) {
  var global = this.window;

  middleware.trigger('sandbox:context', {}, function (err, context) {
    // Allow middleware to run the execution event. This is the perfect handler
    // for async execution cells and even allows people to hook into the code
    // before it runs. Think linters, etc.
    middleware.trigger('sandbox:execute', {
      code:    code,
      context: context,
      window:  global
    }, done);
  });
};

/**
 * Remove the sandbox instance from the document.
 *
 * @return {Sandbox}
 */
Sandbox.prototype.remove = function () {
  this.frame.parentNode.removeChild(this.frame);
  delete this.frame;
  delete this.window;

  return this;
};
