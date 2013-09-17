var loadScript = require('load-script');

/**
 * Set the some additional context variables.
 *
 * @param  {Object}   context
 * @param  {Function} next
 */
var contextPlugin = function (context, next) {
  // Unfortunately it isn't as easy as this since we have lexical scoping issues
  // to the wrong window object. That would load the script in the wrong window.
  context.require = loadScript;

  // Helper properties for executing async code within a cell.
  context.async   = function () {};
  context.timeout = 2000;

  return next();
};

/**
 * Sets up the pre-execution plugin.
 *
 * @param  {Object}   window
 * @param  {Function} next
 */
var executePlugin = function (data, next, done) {
  var code    = 'with (window.console._notebookApi) {\n' + data.code + '\n}';
  var async   = false;
  var exec    = {};
  var context = data.context;

  context.async = function () {
    var timeout;

    // Sets the async flag to true so we won't call the callback immediately.
    async = true;

    // Add a fallback catch in case we are using the `async` function accidently
    // or not handling some edge case. This idea comes from `Mocha` async tests,
    // but here we just need to set `timeout = Infinity`.
    if (isFinite(context.timeout) && context.timeout > 0) {
      timeout = setTimeout(function () {
        return done(
          new Error('Timeout of ' + context.timeout + 'ms exceeded'), exec
        );
      }, context.timeout);
    }

    // Return a function that can be executed to end the async operation inside
    // the cell. This is handy for all sorts of things, like ajax requests.
    return function (err, result) {
      // Clear the failure timeout.
      clearTimeout(timeout);

      // Passes iteration off to the middleware since it already caters for
      // async execution like this. This function accepts two parameters, like
      // a normal async callback, but instead off passing it directly off to
      // `done`, we need to transform it into the data format the result
      // cell understands and pass `null` as the error since we don't have an
      // execution error in this context (it came from the sandbox).
      exec.result  = err || result;
      exec.isError = !!err;
      return done(null, exec);
    };
  };

  /* jshint evil: true */
  data.window.eval('console._notebookApi.require = ' + context.require);

  // Uses an asynchronous callback to clear the any possible stack trace
  // that would include implementation logic.
  // TODO: Augment the stack trace to remove any existing implementation logic.
  process.nextTick(function () {
    try {
      /* jshint evil: true */
      exec.result  = data.window.eval(code);
      exec.isError = false;
    } catch (error) {
      exec.result  = error;
      exec.isError = true;
    } finally {
      return !async && done(null, exec);
    }
  });
};

/**
 * Attach sandbox related core middleware.
 *
 * @param  {Object} middleware
 */
module.exports = function (middleware) {
  middleware.core('sandbox:execute', executePlugin);
  middleware.core('sandbox:context', contextPlugin);
};
