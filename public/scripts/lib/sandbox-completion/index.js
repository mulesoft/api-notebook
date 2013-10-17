var _        = require('underscore');
var ecma5    = require('./ecma5.json');
var browser  = require('./browser.json');
var fromPath = require('../from-path');

/**
 * Recurse through the description structure and attach descriptions to nodes
 * using a `Map` interface.
 *
 * @param  {WeakMap} map
 * @param  {Object}  describe
 * @param  {Object}  global
 * @return {WeakMap}
 */
var attachDescriptions = function (map, describe, global) {
  (function recurse (description, context) {
    // Break recursion on a non-Object.
    if (!_.isObject(context)) { return; }

    // Set the map object reference to point to the description.
    map.set(context, description);

    if (_.isObject(description)) {
      // Iterate over the description object and attach more definitions.
      _.each(description, function (describe, key) {
        // Tern.js definitions prepend an exclamation mark to definition types.
        if (key.charAt(0) === '!') { return; }

        return recurse(describe, context[key]);
      });
    }
  })(describe, global);

  return map;
};

/**
 * Accepts a window object and returns an object for use with middleware.
 *
 * @param  {Object} sandbox
 * @return {Object}
 */
module.exports = function (global) {
  var map     = new WeakMap();
  var exports = {};
  var plugins = {};

  // Attach pre-defined global description objects.
  attachDescriptions(map, ecma5,   global);
  attachDescriptions(map, browser, global);

  /**
   * Middleware plugin for describing native types.
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  plugins['completion:describe'] = function (data, next, done) {
    // TODO: Improve detection of primitives and use the parent context object.
    var description = map.get(data.context);

    // If we didn't find a description, pass the lookup off to the next
    // middleware.
    if (description == null) {
      return next();
    }

    return done(null, description);
  };

  /**
   * Attach all the relevant middleware plugins.
   *
   * @param {Object} middleware
   */
  exports.attach = function (middleware) {
    /**
     * Middleware for looking up function return types for native functions.
     *
     * @param {Object}   data
     * @param {Function} next
     * @param {Function} done
     */
    plugins['completion:function'] = function (data, next, done) {
      if (data.isConstructor || data.context === data.global.Array) {
        return done(null, data.context.prototype);
      }

      // This may be a little dodgy, but as long as someone hasn't extended the
      // native prototype object with something that has side-effects, we'll be
      // fine.
      if (!_.isObject(data.parent)) {
        return done(null, data.context.call(data.parent));
      }

      // Use the documentation to detect the return types.
      middleware.trigger('completion:describe', data, function (err, describe) {
        if (err || !_.isObject(describe) || !/^fn\(/.test(describe['!type'])) {
          return next(err);
        }

        // Split the documentation type and get the return type.
        var returnType = describe['!type'].split(' -> ').pop();

        if (returnType === 'string') {
          return done(null, data.global.String());
        }

        if (returnType === 'number') {
          return done(null, data.global.Number());
        }

        if (returnType === 'bool') {
          return done(null, data.global.Boolean());
        }

        if (/\[.*\]/.test(returnType)) {
          return done(null, data.global.Array());
        }

        if (returnType === 'fn()') {
          return done(null, data.global.Function());
        }

        // Returns its own instance.
        if (returnType === '!this') {
          return done(null, data.parent);
        }

        // Instance type return.
        if (/^\+/.test(returnType) && data.global[returnType.substr(1)]) {
          return done(
            null,
            fromPath(data.global, returnType.substr(1).split('.')).prototype
          );
        }

        return next();
      });
    };

    middleware.use(plugins);
  };

  /**
   * Detach relevant middleware and cleanup memory.
   *
   * @param {Object} middleware
   */
  exports.detach = function (middleware) {
    middleware.disuse(plugins);
  };

  return exports;
};
