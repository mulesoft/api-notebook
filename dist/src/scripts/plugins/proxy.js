/* global App */
var _         = App.Library._;
var url       = App.Library.url;
var PROXY_URL = process.env.plugins.proxy && process.env.plugins.proxy.url;

/**
 * Augment the ajax middleware with proxy urls when we make requests to a
 * recognised API endpoint.
 *
 * @param  {Object}   data
 * @param  {Function} next
 */
var ajaxPlugin = function (data, next) {
  // Allow the proxy to be bypassed completely.
  if (data.proxy === false) {
    return next();
  }

  var uri   = url.parse(data.url);
  var proxy = _.isString(data.proxy) ? data.proxy : PROXY_URL;

  // Attach the proxy if the url is not a relative url.
  if (proxy && uri.protocol && uri.host) {
    data.url = url.resolve(window.location.href, proxy) + '/' + data.url;
  }

  return next();
};

/**
 * A { key: function } map of all middleware used in the plugin.
 *
 * @type {Object}
 */
module.exports = {
  'ajax': ajaxPlugin
};
