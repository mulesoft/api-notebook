/* global App */
var _           = require('underscore');
var qs          = require('querystring');
var url         = require('url');
var crypto      = require('crypto');
var authWindow  = require('./lib/auth-window');
var middleware  = require('../../../state/middleware');

/**
 * Set the default redirection url.
 *
 * @type {String}
 */
var REDIRECT_URI = url.resolve(
  global.location.href, process.env.application.oauthCallback
);

/**
 * Simple constant for the url encoded content type.
 *
 * @type {String}
 */
var URL_ENCODED = 'application/x-www-form-urlencoded';

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
    return args[0] + '=' + args[1];
  }).join('&');
};

/**
 * Create the base signature string for hashing.
 *
 * @param  {Object} data
 * @return {String}
 */
var createSignatureBase = function (params, data) {
  return [
    data.method.toUpperCase(),
    encodeData(normalizeUrl(data.url)),
    encodeData(arrayToParams(params))
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

  var hash = key;

  if (options.signatureMethod === 'HMAC-SHA1') {
    hash = crypto.createHmac('sha1', key).update(base).digest('base64');
  }

  return hash;
};

/**
 * Generate a signature from the AJAX data.
 *
 * @param  {Array}  params
 * @param  {Object} data
 * @return {String}
 */
var getSignature = function (params, data) {
  var signatureBase = createSignatureBase(params, data);
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
  var params = paramsToArray(_.extend({
    'oauth_timestamp':        getTimestamp(),
    'oauth_nonce':            getNonce(),
    'oauth_version':          '1.0',
    'oauth_signature_method': data.oauth1.signatureMethod,
    'oauth_consumer_key':     data.oauth1.consumerKey
  }, data.url.query));

  // Attach the token query parameter if we have one.
  if (data.oauth1.oauthToken) {
    params.push(['oauth_token', data.oauth1.oauthToken]);
  }

  if (data.oauth1.oauthCallback) {
    params.push(['oauth_callback', data.oauth1.oauthCallback]);
  }

  var contentType = _.find(_.pairs(data.headers), function (header) {
    return header[0].toLowerCase() === 'content-type';
  });

  if (!contentType) {
    contentType = data.headers['Content-Type'] = URL_ENCODED;
  } else {
    contentType = contentType[1];
  }

  if (contentType === URL_ENCODED) {
    if (_.isString(data.data)) {
      data.data = qs.parse(data.data);
    }

    if (_.isObject(data.data)) {
      var body = paramsToArray(data.data);
      data.data = arrayToParams(body);
      params.push.apply(params, body);
    }
  }

  var sortedParams = sortRequestParams(params);

  sortedParams.push(
    ['oauth_signature', encodeData(getSignature(sortedParams, data))]
  );

  return sortedParams;
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
 * @param  {Object} data
 * @param  {Array}  params
 * @return {String}
 */
var buildAuthorizationHeaders = function (data, params) {
  return 'OAuth realm="' + normalizeUrl(data.url) + '",' +
    _.chain(params).filter(function (param) {
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
      oauthCallback: options.redirectUri
    }, options),
    headers: {
      'Content-Type': URL_ENCODED
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
      'Content-Type': URL_ENCODED
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

    if (!_.keys(data.response).length) {
      delete data.response;
    }

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
    }), options, done);

    global.authenticateOAuth = function (href) {
      popup.close();
      delete global.authenticateOAuth;

      if (href.substr(0, options.redirectUri.length) !== options.redirectUri) {
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
 * Trigger authentication via OAuth1.0(A) in the browser.
 *
 * @param {Object}   options
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('authenticate', function (options, next, done) {
  if (options.type === 'OAuth 1.0') {
    return oauth1Flow(_.extend({
      redirectUri: REDIRECT_URI
    }, options), done);
  }

  return next();
});

/**
 * Allow a new ajax flow for OAuth1-based URLs. Accepts an `oauth1` property
 * on the data object in the format that is returned from the middleware.
 *
 * @param {Object}   data
 * @param {Function} next
 */
middleware.register('ajax:oauth1', function (data, next) {
  // Check we have an oauth1 object for attempting to mixin keys.
  if (_.isObject(data.oauth1)) {
    if (!data.oauth1.signatureMethod) {
      data.oauth1.signatureMethod = 'HMAC-SHA1';
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
    var authorization = buildAuthorizationHeaders(data, orderedParams);

    data.headers.Authorization = authorization;

    data.url.query = arrayToParams(
      _.filter(paramsToArray(data.url.query), function (param) {
        return !isParamAnOAuthParameter(param[0]);
      })
    );

    // Reattach the query string if we have one available.
    if (data.url.query) {
      data.url.search = '?' + data.url.query;
      data.url.path   = data.url.pathname + data.url.search;
    }

    data.url = url.format(data.url);
  }

  return middleware.trigger('ajax', data, next);
});
