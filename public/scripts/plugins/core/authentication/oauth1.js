/* global App */
var _           = require('underscore');
var qs          = require('querystring');
var url         = require('url');
var crypto      = require('crypto');
var authWindow  = require('./lib/auth-window');
var redirectUri = url.resolve(
  global.location.href, '/authentication/oauth1.html'
);

/**
 * Default ports of different protocols.
 *
 * @type {Object}
 */
var defaultPorts = {
  'http:':  '80',
  'https:': '443'
};

/**
 * Return the current timestamp in seconds since January 1, 1970 00:00:00 GMT.
 *
 * @return {Number}
 */
var getTimestamp = function () {
  return Math.floor(Date.now() / 1000);
};

/**
 * Encode a string according to RFC3986.
 *
 * @param  {String} str
 * @return {String}
 */
var encodeData = function (str) {
  if (str == null) {
    return '';
  }

  return encodeURIComponent(str)
    .replace(/\'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/\!/g, '%21');
};

/**
 * Decode a string.
 *
 * @param  {String} str
 * @return {String}
 */
var decodeData = function (str) {
  return decodeURIComponent(str.replace(/\+/g, ' '));
};

/**
 * Normalize the url for including with the hashed signature.
 *
 * @param  {Object} uri
 * @return {String}
 */
var normalizeUrl = function (uri) {
  var port = '';

  if (uri.port && defaultPorts[uri.protocol] !== uri.port) {
    port = ':' + uri.port;
  }

  return uri.protocol + '//' + uri.hostname + port + uri.pathname;
};

/**
 * Sort query string parameters (represented as an array of arrays) by name and
 * then value.
 *
 * @param  {Array} argPairs
 * @return {Array}
 */
var sortRequestParams = function (argPairs) {
  return argPairs.sort(function (a, b) {
    if (a[0] === b[0]) {
      return a[1] < b[1] ? -1 : 1;
    }

    return a[0] < b[0] ? -1 : 1;
  });
};

/**
 * Transform an object of key, value pairs to an array of arrays.
 *
 * @param  {Object} obj
 * @return {Array}
 */
var paramsToArray = function (obj) {
  return _.pairs(obj);
};

/**
 * Transform an array of parameters (in nested array form) to a query string.
 *
 * @param  {Array}  array
 * @return {String}
 */
var arrayToParams = function (array) {
  return _.map(array, function (args) {
    return encodeData(args[0]) + '=' + encodeData(args[1]);
  }).join('&');
};

/**
 * Sort query string parameters by alphabetical order and turn in a string.
 *
 * @param  {Object} obj
 * @return {String}
 */
var normaliseRequestParams = function (obj) {
  return arrayToParams(sortRequestParams(paramsToArray(obj)));
};

/**
 * Create the base signature string for hashing.
 *
 * @param  {Object} data
 * @return {String}
 */
var createSignatureBase = function (data) {
  return [
    data.method.toUpperCase(),
    encodeData(normalizeUrl(data.url)),
    encodeData(normaliseRequestParams(data.url.query))
  ].join('&');
};

/**
 * Generate a signature string combining the base signature with consumer
 * secrets.
 *
 * @param  {String} base
 * @param  {Object} data
 * @return {String}
 */
var createSignature = function (base, options) {
  var key = [
    encodeData(options.consumerSecret), encodeData(options.oauthTokenSecret)
  ].join('&');

  var hash = '';

  if (options.signatureMethod === 'PLAINTEXT') {
    hash = key;
  } else {
    hash = crypto.createHmac('sha1', key).update(base).digest('base64');
  }

  return hash;
};

/**
 * Generate a signature from the AJAX data.
 *
 * @param  {Object} data
 * @return {String}
 */
var getSignature = function (data) {
  var signatureBase = createSignatureBase(data);
  return createSignature(signatureBase, data.oauth1);
};

/**
 * Generate a random nonce string.
 *
 * @return {String}
 */
var getNonce = function () {
  var chars = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D',
    'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7',
    '8', '9'
  ];

  var nonce = '';

  for (var i = 0; i < 32; i++) {
    nonce += _.sample(chars);
  }

  return nonce;
};

/**
 * Prepare ordered OAuth parameters based on the provided data.
 *
 * @param  {Object} data
 * @return {Array}
 */
var prepareParameters = function (data) {
  data.url.query = _.extend({
    'oauth_timestamp':        getTimestamp(),
    'oauth_nonce':            getNonce(),
    'oauth_version':          '1.0',
    'oauth_signature_method': 'HMAC-SHA1',
    'oauth_consumer_key':     data.oauth1.consumerKey
  }, data.url.query);

  // Attach the token query parameter if we have one.
  if (data.oauth1.oauthToken) {
    data.url.query.oauth_token = data.oauth1.oauthToken;
  }

  if (data.oauth1.oauthCallback) {
    data.url.query.oauth_callback = data.oauth1.oauthCallback;
  }

  var parameters = sortRequestParams(paramsToArray(data.url.query));

  parameters.push(['oauth_signature', encodeData(getSignature(data))]);

  return parameters;
};

/**
 * Check whether the parameters name is a valid OAuth parameter.
 *
 * @param  {String}  param
 * @return {Boolean}
 */
var isParamAnOAuthParameter = function (param) {
  return (/^oauth_/).test(param);
};

/**
 * Generate the Authorization header from an order parameter array.
 *
 * @param  {Array}  params
 * @return {String}
 */
var buildAuthorizationHeaders = function (params) {
  return 'OAuth ' + _.chain(params).filter(function (param) {
    return isParamAnOAuthParameter(param[0]);
  }).map(function (param) {
    return param[0] + '="' + param[1] + '"';
  }).value().join(',');
};

/**
 * Send a request to get the initial OAuth request tokens.
 *
 * @param {String}   url
 * @param {Function} done
 */
var getRequestToken = function (options, done) {
  return App.middleware.trigger('ajax:oauth1', {
    url:    options.requestTokenUri,
    method: 'POST',
    oauth1: _.extend({
      oauthCallback: redirectUri
    }, options),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, function (err, xhr) {
    if (err) { return done(err); }

    if (xhr.status !== 200) {
      return done(new Error(xhr.responseText || 'Invalid Request'));
    }

    var content = qs.parse(xhr.responseText);

    return done(null, {
      oauthToken:       content.oauth_token,
      oauthTokenSecret: content.oauth_token_secret
    });
  });
};

/**
 * Get the final access token by passing in the request options and the token
 * verifier.
 *
 * @param {Object}   options
 * @param {String}   verifier
 * @param {Function} done
 */
var getAccessToken = function (options, verifier, done) {
  return App.middleware.trigger('ajax:oauth1', {
    url:    options.tokenCredentialsUri,
    method: 'POST',
    oauth1: options,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: qs.stringify({
      'oauth_verifier': verifier
    })
  }, function (err, xhr) {
    if (err) { return done(err); }

    var response = qs.parse(xhr.responseText);

    var data = {
      response:         response,
      oauthToken:       response.oauth_token,
      oauthTokenSecret: response.oauth_token_secret
    };

    // Delete data that has been pulled off the response object to avoid
    // duplication.
    delete response.oauth_token;
    delete response.oauth_token_secret;

    return done(null, data);
  });
};

/**
 * Trigger the full OAuth1 authentication flow.
 *
 * @param {Object}   options
 * @param {Function} done
 */
var oauth1Flow = function (options, done) {
  if (!_.isString(options.consumerKey)) {
    return done(new TypeError('"consumerKey" expected'));
  }

  if (!_.isString(options.consumerSecret)) {
    return done(new TypeError('"consumerSecret" expected'));
  }

  if (!_.isString(options.requestTokenUri)) {
    return done(new TypeError('"requestTokenUri" expected'));
  }

  if (!_.isString(options.authorizationUri)) {
    return done(new TypeError('"authorizationUri" expected'));
  }

  if (!_.isString(options.tokenCredentialsUri)) {
    return done(new TypeError('"tokenCredentialsUri" expected'));
  }

  return getRequestToken(options, function (err, data) {
    if (err) { return done(err); }

    var popup = authWindow(options.authorizationUri + '?' + qs.stringify({
      'oauth_token': data.oauthToken
    }), done);

    global.authenticateOAuth1 = function (href) {
      popup.close();
      delete global.authenticateOAuth2;

      if (href.substr(0, redirectUri.length) !== redirectUri) {
        return done(new Error('Invalid redirect uri'));
      }

      var response = url.parse(href, true).query;

      if (response.oauth_token !== data.oauthToken) {
        return done(new Error('Invalid OAuth token response'));
      }

      return getAccessToken(_.extend({
        oauthToken: response.oauth_token
      }, options), response.oauth_verifier, done);
    };
  });
};

/**
 * Proxy done requests to ensure two arguments are always passed.
 *
 * @param  {Function} done
 * @return {Function}
 */
var proxyDone = function (done) {
  return function (err, data) {
    return done(err, data);
  };
};

/**
 * Register OAuth1 based middleware.
 *
 * @param {Object} middleware
 */
module.exports = function (middleware) {
  /**
   * Trigger authentication via OAuth1.0(A) in the browser. Valid data
   * properties include:
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('authenticate:oauth1', function (data, next, done) {
    return oauth1Flow(data, proxyDone(done));
  });

  /**
   * Allow a new ajax flow for OAuth1-based URLs. Accepts an `oauth1` property
   * on the data object in the format that is returned from the middleware.
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('ajax:oauth1', function (data, next, done) {
    if (!_.isObject(data.oauth1)) {
      return done(new TypeError('"oauth1" config object expected'), null);
    }

    // Parse the url for augmenting the query string parameters. Needed in
    // multiple places throughout the flow, so we can minimize the number of
    // parses by doing it once at the start.
    data.url = url.parse(data.url, true);

    // Delete parameters specific to re-adding the query string, since we need
    // to regenerate the query string without OAuth params.
    delete data.url.href;
    delete data.url.path;
    delete data.url.search;

    var orderedParams = prepareParameters(data);
    var authorization = buildAuthorizationHeaders(orderedParams);

    data.headers.Authorization = authorization;

    data.url.query = arrayToParams(_.filter(orderedParams, function (param) {
      return !isParamAnOAuthParameter(param[0]);
    }));

    // Reattach the query string if we have one available.
    if (data.url.query) {
      data.url.search = '?' + data.url.query;
      data.url.path   = data.url.pathname + data.url.search;
    }

    data.url = url.format(data.url);

    return App.middleware.trigger('ajax', data, next);
  });
};
