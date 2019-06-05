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
 * Register a function callback for the plugin hook. This is similar to connect
 * middleware except plugins are passed a data object, next function and done
 * function. The registered plugins also run in reverse to normal, since we add
 * plugins after application initialization.
 *
 * @param  {String}   name
 * @param  {Function} fn
 * @return {this}
 */
middleware.register = acceptObject(function (name, fn) {
  var stack = this._stack[name] || (this._stack[name] = []);
  this.trigger('middleware:register', {
    name:   name,
    plugin: fn
  });
  stack.push(fn);
  return this;
});

/**
 * Register a plugin that will only run only once.
 *
 * @param  {String}   name
 * @param  {Function} fn
 * @return {this}
 */
middleware.registerOnce = acceptObject(function (name, fn) {
  return this.register(name, function self () {
    middleware.deregister(name, self);
    fn.apply(this, arguments);
    fn = null;
  });
});

/**
 * Removes a function, or all functions, from a given middleware trigger.
 *
 * @param  {String}   name
 * @param  {Function} fn
 * @return {this}
 */
middleware.deregister = acceptObject(function (name, fn) {
  var stack = this._stack[name] || [];

  for (var i = 0; i < stack.length; i++) {
    if (arguments.length < 2 || stack[i] === fn) {
      this.trigger('middleware:deregister', {
        name:   name,
        plugin: stack[i]
      });
      stack.splice(i, 1);
      i -= 1; // Decrement the index by one with the function we just removed.
    }
  }

  // Delete empty arrays.
  if (!stack.length) {
    delete this._stack[name];
  }

  return this;
});

/**
 * Checks whether a middleware stack exists for the
 *
 * @param  {String}  name
 * @return {Boolean}
 */
middleware.exists = function (name) {
  return !!(this._stack[name] && this._stack[name].length);
};

/**
 * Listens to any events triggered on the middleware system and runs through
 * the middleware stack based on the event name.
 *
 * @param {String}   name
 * @param {Object}   data
 * @param {Function} done
 * @param {Function} discard
 */
middleware.listenTo(middleware, 'all', function (name, data, done, discard) {
  var sent  = false;
  var stack = this._stack[name] || [];
  var index = stack.length;
  var previousData;

  // Call the final function when we are done executing the middleware stack.
  // It should also be passed as a parameter of the data object to each
  // middleware operation since it's possible to short-circuit the entire stack.
  var over = function (err, data) {
    // Set the function to have been already "run" and call the final function.
    sent = true;

    if (_.isFunction(done)) {
      // If we don't have enough arguments, send the previous data object.
      if (arguments.length < 2 && !discard) {
        data = previousData;
      }

      return done(err, data);
    }
  };

  // Call the next function on the stack, passing errors from the previous
  // stack call so it could be handled within the stack by another middleware.
  (function move (err, data) {
    var layer = stack[--index];

    // If we were provided two arguments, the second argument would have been
    // an updated data object. If we weren't passed two arguments, use the
    // previous know data object.
    if (arguments.length < 2) {
      data = previousData;
    } else {
      previousData = data;
    }

    // If we have called the done function inside a plugin, or we have hit
    // the end of the stack loop, we need to break the recursive next loop.
    if (sent || !layer) {
      if (!sent) {
        over(err, discard ? null : data);
      }

      return;
    }

    try {
      var arity  = layer.length;
      var called = (function (has) {
        return function (fn) {
          return function () {
            if (has) { return; }

            has = true;
            return fn.apply(null, arguments);
          };
        };
      })(false);

      // Error handling middleware can be registered by using a function with
      // four arguments. E.g. `function (err, data, next, done) {}`. Any
      // functions with less than four arguments will be called when we don't
      // have an error in the pipeline.
      if (err) {
        if (arity > 3) {
          layer(err, data, called(move), called(over));
        } else {
          move(err, data);
        }
      } else if (arity < 4) {
        layer(data, called(move), called(over));
      } else {
        move(null, data);
      }
    } catch (e) {
      move(e, data);
    }
  })(null, data);
});
