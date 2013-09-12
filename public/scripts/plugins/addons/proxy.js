var PROXY_URL = '/proxy';

/**
 * Augment the ajax middleware with proxy urls when we make requests to a
 * recognised API endpoint.
 *
 * @param  {Object}   data
 * @param  {Function} next
 */
var ajaxPlugin = function (data, next) {
  data.url = PROXY_URL + '/' + data.url;
  return next();
};

/**
 * A { key: function } map of all middleware used in the plugin.
 *
 * @type {Object}
 */
var plugins = {
  'ajax': ajaxPlugin
};

/**
 * Attach the middleware to the application.
 *
 * @param {Object} middleware
 */
exports.attach = function (middleware) {
  for (var key in plugins) {
    if (plugins.hasOwnProperty(key)) {
      middleware.use(key, plugins[key]);
    }
  }
};

/**
 * Detaches the middleware from the application. Useful during tests.
 *
 * @param {Object} middleware
 */
exports.detach = function (middleware) {
  for (var key in plugins) {
    if (plugins.hasOwnProperty(key)) {
      middleware.disuse(key, plugins[key]);
    }
  }
};
