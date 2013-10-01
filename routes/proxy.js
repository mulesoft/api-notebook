var _       = require('underscore');
var url     = require('url');
var express = require('express');
var app     = module.exports = express();
var request = require('request');

// Remove `X-Powered-By: Express` header. Disable wasn't working.
app.use(function (req, res, next) {
  res.removeHeader('X-Powered-By');
  return next();
});

/**
 * Uses a simple object representation of urls to merge additional data with
 * proxied requests. TODO: Port this to use RAML.
 *
 * @type {Object}
 */
var mergeData = {
  'github.com/login/oauth/access_token': {
    'client_id':     process.env.GITHUB_CLIENT_ID,
    'client_secret': process.env.GITHUB_CLIENT_SECRET
  }
};

/**
 * Exports a simple http proxy to be used with API requests.
 *
 * @param {Object} req
 * @param {Object} res
 */
app.all('*', function (req, res) {
  var data = {};

  var qs  = data.qs  = req.query;
  var uri = data.uri = url.parse(req.path.substr(1));

  // Extends the query string with additonal url data
  _.extend(qs, mergeData[uri.host + uri.pathname]);

  // Remove any non-proxy specific headers.
  _.each(req.headers, function (value, key) {
    if (key.substr(0, 8) === 'x-proxy-') {
      req.headers[key.substr(8)] = value;
      return delete req.headers[key];
    }

    if (key.substr(0, 12) === 'x-forwarded-') {
      return delete req.headers[key];
    }
  });

  // Pipe the request data directly into the proxy request and back to the
  // response object. This avoids having to buffer content bodies in cases where
  // they could be exepectedly large and unneeded.
  req.pipe(request(data)).pipe(res);
});
