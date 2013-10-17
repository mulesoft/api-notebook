var _       = require('underscore');
var url     = require('url');
var express = require('express');
var app     = module.exports = express();
var request = require('request');

// Remove inherited response headers.
app.use(function (req, res, next) {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Access-Control-Allow-Origin');
  res.removeHeader('Access-Control-Allow-Headers');
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
 * Allow headers to be proxied through *if* the proxy header version is not set.
 *
 * @type {Array}
 */
var allowedHeaders = {
  'accept':          true,
  'accept-encoding': true,
  'accept-language': true,
  'cache-control':   true,
  'connection':      true,
  'content-length':  true,
  'content-type':    true,
  'host':            true,
  'origin':          true,
  'pragma':          true,
  'user-agent':      true
};

/**
 * Exports a simple http proxy to be used with API requests.
 *
 * @param {Object} req
 * @param {Object} res
 */
app.all('*', function (req, res) {
  var data    = {};
  var proxied = {};

  var qs  = data.qs  = req.query;
  var uri = data.uri = url.parse(req.path.substr(1));

  // Extends the query string with additonal url data
  _.extend(qs, mergeData[uri.host + uri.pathname]);

  // Remove any non-proxy specific headers.
  _.each(req.headers, function (value, key) {
    if (key.substr(0, 8) === 'x-proxy-') {
      proxied[key.substr(8)]     = true;
      req.headers[key.substr(8)] = value;
      return delete req.headers[key];
    }

    if (!proxied[key] && !allowedHeaders[key]) {
      return delete req.headers[key];
    }
  });

  var proxy = request(data);

  // Send the proxy error to the client.
  proxy.on('error', function (err) {
    res.send(500, err.message);
  });

  // Pipe the request data directly into the proxy request and back to the
  // response object. This avoids having to buffer content bodies in cases where
  // they could be unexepectedly large or slow.
  req.pipe(proxy).pipe(res);
});
