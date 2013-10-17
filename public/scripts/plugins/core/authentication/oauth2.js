/* global App */
var _           = require('underscore');
var qs          = require('querystring');
var url         = require('url');
var authWindow  = require('./lib/auth-window');
var redirectUri = url.resolve(
  global.location.href, '/authentication/oauth2.html'
);

/**
 * An array containing the supported grant types in preferred order.
 *
 * @type {Array}
 */
var supportedGrants = ['token', 'code'];

/**
 * Format error response types to regular strings for displaying the clients.
 * Reference: http://tools.ietf.org/html/rfc6749#section-4.1.2.1
 *
 * @type {Object}
 */
var errorResponses = {
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
  return errorResponses[data.error] || data.error || data.error_message;
};

/**
 * Fix passed in options objects.
 *
 * @param  {Object} options
 * @return {Object}
 */
var sanitizeOptions = function (options) {
  // Fix up reference to the `scopes` array.
  options.scope = options.scopes;

  if (_.isArray(options.scope)) {
    options.scope = options.scopes.join(' ');
  }

  return options;
};

/**
 * Validate an OAuth2 response object.
 *
 * @param {Object}   response
 * @param {Function} done
 */
var authResponse = function (options, response, done) {
  if (erroredResponse(response)) {
    return done(new Error(erroredResponse(response)));
  }

  var data = {
    scope:       response.scope || options.scope,
    response:    _.omit(response, [
      'access_token', 'refresh_token', 'token_type', 'expires_in', 'scope',
      'state', 'error', 'error_description', 'error_uri'
    ]),
    accessToken: response.access_token
  };

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
 * Trigger the client-side implicit OAuth2 flow.
 *
 * @param {Object}   options
 * @param {Function} done
 */
var oauth2TokenFlow = function (options, done) {
  if (!_.isString(options.clientId)) {
    return done(new TypeError('"clientId" expected'));
  }

  if (!_.isString(options.authorizationUrl)) {
    return done(new TypeError('"authorizationUrl" expected'));
  }

  var state = ('' + Math.random()).substr(2);
  var popup = authWindow(options.authorizationUrl + '?' + qs.stringify({
    'state':         state,
    'scope':         options.scope,
    'client_id':     options.clientId,
    'redirect_uri':  redirectUri,
    'response_type': 'token'
  }), done);

  global.authenticateOAuth2 = function (href) {
    popup.close();
    delete global.authenticateOAuth2;

    var uri      = url.parse(href, true);
    var response = _.extend(qs.parse(uri.hash.substr(1)), uri.query);

    if (href.substr(0, redirectUri.length) !== redirectUri) {
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

  if (!_.isString(options.accessTokenUrl)) {
    return done(new TypeError('"accessTokenUrl" expected'));
  }

  if (!_.isString(options.authorizationUrl)) {
    return done(new TypeError('"authorizationUrl" expected'));
  }

  var state = ('' + Math.random()).substr(2);
  var popup = authWindow(options.authorizationUrl + '?' + qs.stringify({
    'state':         state,
    'scope':         options.scope,
    'client_id':     options.clientId,
    'redirect_uri':  redirectUri,
    'response_type': 'code'
  }), done);

  /**
   * Assigns a global variable that the oauth authentication window should
   * be able to access and send the callback data.
   */
  global.authenticateOAuth2 = function (href) {
    popup.close();
    delete global.authenticateOAuth2;

    // Parse the url and prepare to do an POST request to get the access token.
    var query = url.parse(href, true).query;

    if (href.substr(0, redirectUri.length) !== redirectUri) {
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
      url: options.accessTokenUrl,
      method: 'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: qs.stringify({
        'code':          query.code,
        'grant_type':    'authorization_code',
        'redirect_uri':  redirectUri,
        'client_id':     options.clientId,
        'client_secret': options.clientSecret
      })
    }, function (err, xhr) {
      if (err) { return done(err); }

      return authResponse(options, JSON.parse(xhr.responseText), done);
    });
  };
};

/**
 * Function for simply proxy two parameters to a done function. Required since
 * the function may not return parameters but when the middleware doesn't
 * recieve two parameters in passes the previous data object back through.
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
 * Register OAuth2 based middleware. Handles OAuth2 implicit auth flow, and the
 * normal OAuth2 authentication flow when using with a proxy server.
 *
 * @param {Object} middleware
 */
module.exports = function (middleware) {
  /**
   * Trigger authentication via OAuth2.0 in the browser. Valid data properties:
   *
   *   `accessTokenUrl`      - "https://www.example.com/oauth2/token"
   *   `authorizationUrl`    - "https://www.example.com/oauth2/authorize"
   *   `clientId`            - EXAMPLE_CLIENT_ID
   *   `clientSecret`        - EXAMPLE_CLIENT_SECRET
   *   `authorizationGrants` - ["code"]
   *   `scopes`              - ["user", "read", "write"]
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('authenticate:oauth2', function (data, next, done) {
    // Sanitize authorization grants to an array.
    if (_.isString(data.authorizationGrants)) {
      data.authorizationGrants = [data.authorizationGrants];
    }

    // Use insection to get the accepted grant types in the order of the
    // supported grant types (which are ordered by preference).
    var grantType = _.intersection(
      supportedGrants, data.authorizationGrants
    )[0];

    if (!grantType) {
      return done(new Error(
        'Unsupported OAuth2 Grant Flow. Supported flows include ' +
        supportedGrants.join(', ')
      ));
    }

    // Commit to the whole OAuth2 dance using the accepted grant type.
    return middleware.trigger(
      'authenticate:oauth2:' + grantType, data, done
    );
  });

  /**
   * Middleware for authenticating using the OAuth2 code grant flow.
   * Reference: http://tools.ietf.org/html/rfc6749#section-4.1
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('authenticate:oauth2:code', function (data, next, done) {
    return oAuth2CodeFlow(sanitizeOptions(data), proxyDone(done));
  });

  /**
   * Middleware for authenticating with the OAuth2 implicit auth flow.
   * Reference: http://tools.ietf.org/html/rfc6749#section-4.2
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('authenticate:oauth2:token', function (data, next, done) {
    return oauth2TokenFlow(sanitizeOptions(data), proxyDone(done));
  });

  /**
   * Allow a new ajax flow for OAuth2-based URLs. Accepts an `oauth2` property
   * on the data object in the format that is returned from the middleware.
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('ajax:oauth2', function (data, next, done) {
    if (!_.isObject(data.oauth2) || !data.oauth2.accessToken) {
      return done(new TypeError('"oauth2" config object expected'), null);
    }

    if (data.oauth2.tokenType === 'bearer') {
      data.headers = _.extend({
        'Authorization': 'Bearer ' + data.oauth2.accessToken
      }, data.headers);
    } else {
      // Add the access token to the request query.
      var uri = url.parse(data.url, true);
      uri.query.access_token = data.oauth2.accessToken;

      // Update ajax data headers and url.
      data.url = url.format(uri);
      data.headers = _.extend({
        'Pragma':        'no-store',
        'Cache-Control': 'no-store'
      }, data.headers);
    }

    // Trigger the regular ajax method.
    return middleware.trigger('ajax', data, done);
  });
};
