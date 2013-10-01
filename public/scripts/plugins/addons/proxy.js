/* global App */
var _         = App._;
var PROXY_URL = '/proxy';

/**
 * Augment the ajax middleware with proxy urls when we make requests to a
 * recognised API endpoint.
 *
 * @param  {Object}   data
 * @param  {Function} next
 */
var ajaxPlugin = function (data, next) {
  // Copy all the keys to be proxied.
  _.each(data.headers, function (value, key) {
    delete data.headers[key];
    data.headers['X-Proxy-' + key] = value;
  });

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
