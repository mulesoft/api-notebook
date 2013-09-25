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

  // Github requires we pass basic auth when checking authorizations
  if ((uri.host + uri.pathname).indexOf('api.github.com/applications') === 0) {
    data.auth = {
      user: process.env.GITHUB_CLIENT_ID,
      pass: process.env.GITHUB_CLIENT_SECRET
    };
  }

  // Remove any `x-forwarded-*` headers set by the upstream proxy (E.g. Heroku).
  // Keeping these headers may cause APIs to do unexpected things, such as
  // Github which redirects requests when `x-forwarded-proto` === `http`.
  _.each(req.headers, function (_, key) {
    if (key.substr(0, 11) === 'x-forwarded') {
      delete req.headers[key];
    }
  });

  // Pipe the request data directly into the proxy request and back to the
  // response object. This avoids having to buffer content bodies in cases where
  // they could be exepectedly large and unneeded.
  req.pipe(request(data)).pipe(res);
});
