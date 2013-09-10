/**
 * Middleware plugin architecture. Available middleware hooks:
 *
 * `completion:filter`   - Filter completion suggestions from being displayed.
 * `completion:variable` - Augment a variable name lookup with custom results.
 * `completion:context`  - Augment a context lookup which is used for the base
 *                         object of a property lookup.
 * `completion:property` - Augment a property name lookup with custom results.
 * `inspector:filter`    - Filter properties from displaying in the inspector.
 * `result:render`       - Render the result or error of a code cell execution.
 * `result:empty`        - Remove the result of a code cell execution.
 */
var _        = require('underscore');
var Backbone = require('backbone');

/**
 * An event based implementation of a namespaced middleware system. Provides a
 * method to register new plugins and a queue system to trigger plugin hooks
 * while still being capable of having a fallback function.
 *
 * @type {Object}
 */
var middleware = module.exports = _.extend({}, Backbone.Events);

/**
 * The stack is an object that contains all the middleware functions to be
 * executed on an event. Similar in concept to `Backbone.Events._events`.
 * @type {Object}
 */
middleware._stack = {};

/**
 * The core is an object that contains middleware that should always be run last
 * in the stack. To avoid abuse of the system, it only allows a single plugin
 * to be registered per namespace compared to the stack.
 *
 * @type {Object}
 */
middleware._core = {};

/**
 * Register a function callback for the plugin hook. This is akin to the connect
 * middleware system, albeit with some modifications to play nicely using
 * Backbone Events and a custom callback syntax since we aren't dealing with
 * request/response applications.
 *
 * @param  {String}   namespace
 * @param  {Function} fn
 * @return {this}
 */
middleware.use = function (name, fn) {
  var stack = this._stack[name] || (this._stack[name] = []);
  stack.push(fn);
  return this;
};

/**
 * Register a core middleware plugin. Core middleware plugins function
 * identically to regular middleware, except you can only ever register one core
 * middleware per namespace and it will always be run last on the stack.
 *
 * @param  {String}   name
 * @param  {Function} fn
 * @return {this}
 */
middleware.core = function (name, fn) {
  this._core[name] = fn;
  return this;
};

/**
 * Removes a function, or all functions, from a given namespace.
 *
 * @param  {String}   name
 * @param  {Function} fn
 * @return {this}
 */
middleware.disuse = function (name, fn) {
  if (!fn) {
    delete this._stack[name];
    return this;
  }

  var stack = this._stack[name];
  for (var i = 0; i < stack.length; i++) {
    if (stack[i] === fn) {
      stack.splice(i, 1);
      i--;
    }
  }

  if (!stack.length) { delete this._stack[name]; }

  return this;
};

/**
 * Listens to any events triggered on the middleware system and runs through the
 * middleware stack based on the event name.
 *
 * @param  {String}   name Event name to listen to.
 * @param  {Object}   data Basic object with all the data to pass to a plugin.
 * @param  {Function} done A callback function to call when the stack has
 *                         finished executing.
 */
middleware.listenTo(middleware, 'all', function (name, data, out) {
  var sent  = false;
  var index = 0;
  var stack = _.toArray(this._stack[name]);

  // Core plugins should always be appended to the end of the stack.
  if (this._core[name]) { stack.push(this._core[name]); }

  // Call the final function when are done executing the stack of functions.
  // It should also be passed as a parameter of the data object to each
  // middleware operation since we could short-circuit the entire stack.
  var done = function (err) {
    if (sent) { return; }
    sent = true;
    if (_.isFunction(out)) { out(err, data); }
  };

  // Call the next function on the stack, passing errors from the previous
  // stack call so it could be handled within the stack by another middleware.
  (function next (err) {
    var layer = stack[index++];

    if (sent || !layer) {
      if (!sent) { done(err); }
      return;
    }

    try {
      var arity = layer.length;

      // Error handling middleware can be registered by using a function with
      // four arguments. E.g. `function (err, data, next, done) {}`. Any
      // functions with less than four arguments will be called when we don't
      // have an error in the pipeline.
      if (err) {
        if (arity === 4) {
          layer(err, data, next, done);
        } else {
          next(err);
        }
      } else if (arity < 4) {
        layer(data, next, done);
      } else {
        next();
      }
    } catch (e) {
      next(e);
    }
  })();
});
