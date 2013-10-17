/* global App */
var _                = App._;
var FILTER_PROPS     = ['@return', '@arguments', '@description'];
var RETURN_PROP      = FILTER_PROPS[0];
var ARGUMENTS_PROP   = FILTER_PROPS[1];
var DESCRIPTION_PROP = FILTER_PROPS[2];

/**
 * Filters `@return` from showing up in the inspector view.
 *
 * @param {Object}   data
 * @param {Function} next
 */
var inspectorFilterPlugin = function (data, next, done) {
  if (_.isFunction(data.parent) && _.contains(FILTER_PROPS, data.property)) {
    return done(null, false);
  }

  return next();
};

/**
 * Augments the completion context to take into account the `@return` property.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var completionFunctionPlugin = function (data, next, done) {
  // Completes the return property in functions, when available.
  if (RETURN_PROP in data.context) {
    return done(null, data.context[RETURN_PROP]);
  }

  return next();
};

/**
 * Augments the completion function with arguments.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var completionArgumentsPlugin = function (data, next, done) {
  // Completes the arguments property in functions, when available.
  if (ARGUMENTS_PROP in data.context) {
    return done(null, data.context[ARGUMENTS_PROP]);
  }

  return next();
};

var completionDescribePlugin = function (data, next, done) {
  if (DESCRIPTION_PROP in data.context) {
    return done(null, data.context[DESCRIPTION_PROP]);
  }

  return next();
};

/**
 * A { key: function } map of all middleware used in the plugin.
 *
 * @type {Object}
 */
var plugins = {
  'inspector:filter':     inspectorFilterPlugin,
  'completion:function':  completionFunctionPlugin,
  'completion:describe':  completionDescribePlugin,
  'completion:arguments': completionArgumentsPlugin
};

/**
 * Attach the middleware to the application.
 *
 * @param {Object} middleware
 */
exports.attach = function (middleware) {
  middleware.use(plugins);
};

/**
 * Detaches the middleware from the application. Useful during tests.
 *
 * @param {Object} middleware
 */
exports.detach = function (middleware) {
  middleware.disuse(plugins);
};
