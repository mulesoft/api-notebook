/* global App */
var _           = require('underscore');
var qs          = require('querystring');
var url         = require('url');
var authWindow  = require('./lib/auth-window');
var middleware  = require('../../../state/middleware');

var JSON_REGEXP = /^application\/([\w!#\$%&\*`\-\.\^~]*\+)?json$/i;

/**
 * Set the default redirection url.
 *
 * @type {String}
 */
var REDIRECT_URI = url.resolve(
  global.location.href, process.env.application.oauthCallback
);

/**
 * An array containing the supported grant types in preferred order.
 *
 * @type {Array}
 */
var SUPPORTED_GRANTS = ['token', 'code', 'credentials'];

/**
 * Format error response types to regular strings for displaying the clients.
 * Reference: http://tools.ietf.org/html/rfc6749#section-4.1.2.1
 *
 * @type {Object}
 */
var ERROR_RESPONSES = {
  'invalid_request': [
    'The request is missing a required parameter, includes an',
    'invalid parameter value, includes a parameter more than',
    'once, or is otherwise malformed.'
  ].join(' '),
  'invalid_client': [
    'Client authentication failed (e.g., unknown client, no',
    'client authentication included, or unsupported',
    'authentication method).'
  ].join(' '),
  'invalid_grant': [
    'The provided authorization grant (e.g., authorization',
    'code, resource owner credentials) or refresh token is',
    'invalid, expired, revoked, does not match the redirection',
    'URI used in the authorization request, or was issued to',
    'another client.'
  ].join(' '),
  'unauthorized_client': [
    'The client is not authorized to request an authorization',
    'code using this method.'
  ].join(' '),
  'unsupported_grant_type': [
    'The authorization grant type is not supported by the',
    'authorization server.'
  ].join(' '),
  'access_denied': [
    'The resource owner or authorization server denied the request.'
  ].join(' '),
  'unsupported_response_type': [
    'The authorization server does not support obtaining',
    'an authorization code using this method.'
  ].join(' '),
  'invalid_scope': [
    'The requested scope is invalid, unknown, or malformed.'
  ].join(' '),
  'server_error': [
    'The authorization server encountered an unexpected',
    'condition that prevented it from fulfilling the request.',
    '(This error code is needed because a 500 Internal Server',
    'Error HTTP status code cannot be returned to the client',
    'via an HTTP redirect.)'
  ].join(' '),
  'temporarily_unavailable': [
    'The authorization server is currently unable to handle',
    'the request due to a temporary overloading or maintenance',
    'of the server.'
  ].join(' ')
};

/**
 * Return the formatted error string.
 *
 * @param  {Object} data
 * @return {String}
 */
var erroredResponse = function (data) {
  return ERROR_RESPONSES[data.error] || data.error || data.error_message;
};

/**
 * Fix passed in options objects.
 *
 * @param  {Object} options
 * @return {Object}
 */
var sanitizeOptions = function (options) {
  // Extend an default options object.
  var opts = _.extend({
    redirectUri: REDIRECT_URI
  }, options);

  // Fix up reference to the `scopes` array.
  opts.scope = opts.scope || opts.scopes;

  if (_.isArray(opts.scope)) {
    opts.scope = opts.scope.join(' ');
  }

  // Remove unused `scopes` property.
  delete opts.scopes;

  return opts;
};

/**
 * Validate an OAuth2 response object.
 *
 * @param {Object}   options
 * @param {Object}   response
 * @param {Function} done
 */
var authResponse = function (options, response, done) {
  // Check the response object for errors.
  if (erroredResponse(response)) {
    return done(new Error(erroredResponse(response)));
  }

  // Filter the response data of known parameters.
  var data = {
    scope: response.scope || options.scope,
    response: _.omit(response, [
      'access_token', 'refresh_token', 'token_type', 'expires_in', 'scope',
      'state', 'error', 'error_description', 'error_uri'
    ]),
    accessToken: response.access_token
  };

  // Omit the response object altogether if no response is available.
  if (!_.keys(data.response).length) {
    delete data.response;
  }

  if (response.token_type) {
    data.tokenType = response.token_type;
  }

  if (+response.expires_in) {
    data.expires = Date.now() + (response.expires_in * 1000);
  }

  if (response.refresh_token) {
    data.refreshToken = response.refresh_token;
  }

  return done(null, data);
};

/**
 * Handle the xhr response for OAuth requests consistently.
 *
 * @param  {Object}   options
 * @param  {Function} done
 * @return {Function}
 */
var handleAjaxResponse = function (options, done) {
  return function (err, xhr) {
    if (err) {
      return done(err);
    }

    var body = xhr.responseText;
    var mime = (xhr.getResponseHeader('Content-Type') || '').split(';')[0];

    // Attempt to parse the response and pass to the auth response handler. If
    // anything fails, return `done` with the error.
    try {
      if (JSON_REGEXP.test(mime)) {
        return authResponse(options, JSON.parse(body), done);
      } else {
        return authResponse(options, qs.parse(body), done);
      }
    } catch (e) {
      return done(e);
    }
  };
};

/**
 * Trigger the client-side implicit OAuth2 flow.
 * Reference: http://tools.ietf.org/html/rfc6749#section-4.2
 *
 * @param {Object}   options
 * @param {Function} done
 */
var oAuth2TokenFlow = function (options, done) {
  if (!_.isString(options.clientId)) {
    return done(new TypeError('"clientId" expected'));
  }

  if (!_.isString(options.authorizationUri)) {
    return done(new TypeError('"authorizationUri" expected'));
  }

  var state = ('' + Math.random()).substr(2);
  var popup = authWindow(options.authorizationUri + '?' + qs.stringify({
    'state':         state,
    'scope':         options.scope,
    'client_id':     options.clientId,
    'redirect_uri':  options.redirectUri,
    'response_type': 'token'
  }), options, done);

  global.authenticateOAuth = function (href) {
    popup.close();
    delete global.authenticateOAuth;

    var uri      = url.parse(href, true);
    var response = _.extend(qs.parse((uri.hash || '').substr(1)), uri.query);

    if (href.substr(0, options.redirectUri.length) !== options.redirectUri) {
      return done(new Error('Invalid redirect uri'));
    }

    if (response.state !== state) {
      return done(new Error('State mismatch'));
    }

    // Pass the response off for validation. At least Instagram has a bug where
    // the state is being passed back as part of the query string instead of the
    // hash, so we merge both options together.
    return authResponse(options, response, done);
  };
};

/**
 * Trigger the full server-side OAuth2 flow.
 * Reference: http://tools.ietf.org/html/rfc6749#section-4.1
 *
 * @param {Object}   options
 * @param {Function} done
 */
var oAuth2CodeFlow = function (options, done) {
  if (!_.isString(options.clientId)) {
    return done(new TypeError('"clientId" expected'));
  }

  if (!_.isString(options.clientSecret)) {
    return done(new TypeError('"clientSecret" expected'));
  }

  if (!_.isString(options.accessTokenUri)) {
    return done(new TypeError('"accessTokenUri" expected'));
  }

  if (!_.isString(options.authorizationUri)) {
    return done(new TypeError('"authorizationUri" expected'));
  }

  var state = ('' + Math.random()).substr(2);
  var popup = authWindow(options.authorizationUri + '?' + qs.stringify({
    'state':         state,
    'scope':         options.scope,
    'client_id':     options.clientId,
    'redirect_uri':  options.redirectUri,
    'response_type': 'code'
  }), options, done);

  /**
   * Assigns a global variable that the oauth authentication window should
   * be able to access and send the callback data.
   */
  global.authenticateOAuth = function (href) {
    popup.close();
    delete global.authenticateOAuth;

    // Parse the url and prepare to do an POST request to get the access token.
    var query = url.parse(href, true).query;

    if (href.substr(0, options.redirectUri.length) !== options.redirectUri) {
      return done(new Error('Invalid redirect uri'));
    }

    if (erroredResponse(query)) {
      return done(new Error(erroredResponse(query)));
    }

    if (query.state !== state) {
      return done(new Error('State mismatch'));
    }

    if (!query.code) {
      return done(new Error('Response code missing'));
    }

    App.middleware.trigger('ajax', {
      url: options.accessTokenUri,
      method: 'POST',
      headers: {
        'Accept':       'application/json, application/x-www-form-urlencoded',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: qs.stringify({
        'code':          query.code,
        'grant_type':    'authorization_code',
        'redirect_uri':  options.redirectUri,
        'client_id':     options.clientId,
        'client_secret': options.clientSecret
      })
    }, handleAjaxResponse(options, done));
  };
};

/**
 * Trigger the OAuth2 credential flow using headers.
 * Reference: http://tools.ietf.org/html/rfc6749#section-4.4
 *
 * @param {Object}   options
 * @param {Function} done
 */
var oAuth2CredentialsFlow = function (options, done) {
  if (!_.isString(options.clientId)) {
    return done(new TypeError('"clientId" expected'));
  }

  if (!_.isString(options.clientSecret)) {
    return done(new TypeError('"clientSecret" expected'));
  }

  if (!_.isString(options.accessTokenUri)) {
    return done(new TypeError('"accessTokenUri" expected'));
  }

  // Get the token by passing the client details in the auth header.
  App.middleware.trigger('ajax', {
    url: options.accessTokenUri,
    method: 'POST',
    headers: {
      'Accept':        'application/json, application/x-www-form-urlencoded',
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + new Buffer(
        options.clientId + ':' + options.clientSecret
      ).toString('base64')
    },
    data: qs.stringify({
      'grant_type': 'client_credentials'
    })
  }, handleAjaxResponse(options, done));
};

/**
 * Map authentication methods to a function.
 *
 * @type {Object}
 */
var authenticate = {
  code:        oAuth2CodeFlow,
  token:       oAuth2TokenFlow,
  credentials: oAuth2CredentialsFlow
};

/**
 * Trigger authentication via OAuth2.0 in the browser. Valid data properties:
 *
 *   `accessTokenUri`      - "https://www.example.com/oauth2/token"
 *   `authorizationUri`    - "https://www.example.com/oauth2/authorize"
 *   `clientId`            - EXAMPLE_CLIENT_ID
 *   `clientSecret`        - EXAMPLE_CLIENT_SECRET
 *   `authorizationGrants` - ["code", "token", "credentials"]
 *   `scopes`              - ["user", "read", "write"]
 *
 * @param {Object}   options
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('authenticate', function (options, next, done) {
  if (options.type !== 'OAuth 2.0') {
    return next();
  }

  // Sanitize authorization grants to an array.
  if (_.isString(options.authorizationGrants)) {
    options.authorizationGrants = [options.authorizationGrants];
  }

  // Use insection to get the accepted grant types in the order of the
  // supported grant types (which are ordered by preference).
  var grantType = _.intersection(
    SUPPORTED_GRANTS, options.authorizationGrants
  )[0];

  if (!grantType) {
    return done(new Error(
      'Unsupported OAuth2 Grant Flow. Supported flows include ' +
      SUPPORTED_GRANTS.join(', ')
    ));
  }

  return authenticate[grantType](sanitizeOptions(options), done);
});

/**
 * Allow a new ajax flow for OAuth2-based URLs. Accepts an `oauth2` property
 * on the data object in the format that is returned from the middleware.
 *
 * @param {Object}   data
 * @param {Function} next
 */
middleware.register('ajax:oauth2', function (data, next) {
  // Check that we have an access token to use for the request and mix it in.
  if (_.isObject(data.oauth2) && data.oauth2.accessToken) {
    if ((data.oauth2.tokenType || '').toLowerCase() === 'bearer') {
      data.headers = _.extend({
        'Authorization': 'Bearer ' + data.oauth2.accessToken
      }, data.headers);
    } else {
      // Add the access token to the request query.
      var uri = url.parse(data.url, true);
      uri.query.access_token = data.oauth2.accessToken;
      delete uri.search;

      // Update ajax data headers and url.
      data.url = url.format(uri);
      data.headers = _.extend({
        'Pragma':        'no-store',
        'Cache-Control': 'no-store'
      }, data.headers);
    }
  }

  return middleware.trigger('ajax', data, next);
});
