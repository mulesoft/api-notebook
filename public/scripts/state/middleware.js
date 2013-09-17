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
 * `persistence:change`        - Every time the notebook contents change.
 * `persistence:serialize`     - Serialize the collection of cells into a format
 *                               that can be sent to the server.
 * `persistence:deserialize`   - Deserialize data from the server into an array
 *                               of cells the notebook collection can consume.
 * `persistence:authenticate`  - Triggers an authentication check of the user,
 *                               needs to return a user id that can be used to
 *                               decide if we are the owner of a notebook.
 * `persistence:authenticated` - Used to load an initial session, should not
 *                               trigger any sort of authentication.
 * `persistence:load`          - Load a notebook from somewhere.
 * `persistence:save`          - Save a notebook to somewhere.
 * `ajax`                - Submit an asynchonous ajax request that will be
 *                         responded with the ajax object.
 * `authenticate:oauth2` - Trigger the oauth2 authentication flow.
 * `sandbox:context`     - Provide additional context variables to the sandbox.
 */
var _        = require('underscore');
var Backbone = require('backbone');

/**
 * Return a function that transforms a function into accept a single object
 * with the key as the first function parameter and the value as the second
 * function parameter.
 *
 * @param  {Function} fn
 * @return {Function}
 */
var acceptObject = function (fn) {
  return function (object) {
    if (typeof object === 'object') {
      return _.each(object, function (value, key) {
        return fn.call(this, key, value);
      }, this);
    }

    return fn.apply(this, arguments);
  };
};

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
middleware.use = acceptObject(function (name, fn) {
  var stack = this._stack[name] || (this._stack[name] = []);
  stack.push(fn);
  return this;
});

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
middleware.disuse = acceptObject(function (name, fn) {
  if (!fn || !this._stack[name]) {
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
});

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
  var that  = this;
  var sent  = false;
  var index = 0;
  var prevData;

  // Set up the initial stack.
  var stack = _.map(this._stack[name], function (fn) {
    return {
      fn:   fn,
      args: []
    };
  });

  // An "all" middleware listener can be hooked onto in a similar fashion to the
  // "all" Backbone event. It is passed an additional name parameter as the
  // first argument of the callback function.
  stack.push.apply(stack, _.map(this._stack.all, function (fn) {
    return {
      fn:   fn,
      args: [name]
    };
  }));

  // Core plugins should always be appended to the end of the stack.
  if (_.isFunction(this._core[name])) {
    stack.push({
      fn:   this._core[name],
      args: []
    });
  }

  // Call the final function when are done executing the stack of functions.
  // It should also be passed as a parameter of the data object to each
  // middleware operation since we could short-circuit the entire stack.
  var done = function (err, data) {
    if (sent)                 { return; }
    if (arguments.length < 2) { data = prevData; }
    sent = true;
    if (_.isFunction(out)) { out(err, data); }
  };

  // Call the next function on the stack, passing errors from the previous
  // stack call so it could be handled within the stack by another middleware.
  (function next (err, data) {
    var layer  = stack[index++];

    // If we were provided two arguments, the second argument would have been
    // an updated data object. If we weren't passed two arguments, use the
    // previous know data object.
    if (arguments.length < 2) {
      data = prevData;
    } else {
      prevData = data;
    }

    // If we have called the done callback inside the middleware, or we have hit
    // the end of the stack loop, we need to break the recursive next loop.
    if (sent || !layer) {
      if (!sent) { done(err, data); }
      return;
    }

    var plugin = layer.fn;
    var args   = layer.args;

    try {
      var arity = plugin.length - args.length;

      // Error handling middleware can be registered by using a function with
      // four arguments. E.g. `function (err, data, next, done) {}`. Any
      // functions with less than four arguments will be called when we don't
      // have an error in the pipeline.
      if (err) {
        if (arity === 4) {
          args.push(err, data, next, done);
          plugin.apply(null, args);
        } else {
          next(err, data);
        }
      } else if (arity < 4) {
        args.push(data, next, done);
        plugin.apply(null, args);
      } else {
        next(null, data);
      }
    } catch (e) {
      next(e, data);
    }
  })(null, data);
});
