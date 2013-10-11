/* global App */
var _   = require('underscore');
var qs  = require('querystring');
var url = require('url');
var openPopup; // Keep a reference to open popup windows.

/**
 * Generate a custom store for OAuth2 tokens.
 *
 * @type {Object}
 */
var oauth2Store = App.store.customStore('oauth2');

/**
 * An array containing the supported grant types in preferred order.
 *
 * @type {Array}
 */
var supportedGrants = ['code'];

/**
 * Return a unique key for storing the access token in localStorage.
 *
 * @param  {Object} data
 * @return {String}
 */
var tokenKey = function (data) {
  if (!_.isString(data.authorizationUrl)) {
    throw new Error('OAuth2: "authorizationUrl" is missing');
  }

  return data.authorizationUrl;
};

/**
 * Sanitize OAuth2 option keys.
 *
 * @param  {Object} data
 * @return {Object}
 */
var sanitizeOptions = function (data) {
  var options = _.extend({}, {
    scopes:              [],
    authorizationGrants: ['code']
  }, data);

  return options;
};

/**
 * If we already have an access token, we can do a quick validation check.
 *
 * @param {Object}   options
 * @param {Function} done
 */
var validateToken = function (options, done) {
  if (!options.validateUrl || !oauth2Store.has(tokenKey(options))) {
    return done();
  }

  var auth = oauth2Store.get(tokenKey(options));

  App.middleware.trigger('ajax:oauth2', {
    url:    options.validateUrl,
    oauth2: options
  }, function (err, xhr) {
    // Check if the response returned any type of error.
    if (err || Math.floor(xhr.status / 100) !== 2) {
      oauth2Store.unset(tokenKey(options));
      return done(err);
    }

    oauth2Store.set(tokenKey(options), auth);

    // Return the auth object extended with the ajax request.
    return done(null, _.extend({}, auth, {
      xhr: xhr
    }));
  });
};

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
 * Trigger the full server-side OAuth2 flow.
 *
 * @param {Object}   options
 * @param {Function} done
 */
var oAuth2CodeFlow = function (options, done) {
  var errorPrefix = 'OAuth2 Code Grant: ';

  if (!_.isString(options.clientId)) {
    return done(new Error(errorPrefix + '"clientId" is missing'));
  }

  if (!_.isString(options.clientSecret)) {
    return done(new Error(errorPrefix + '"clientSecret" is missing'));
  }

  if (!_.isString(options.accessTokenUrl)) {
    return done(new Error(errorPrefix + '"accessTokenUrl" is missing'));
  }

  if (!_.isString(options.authorizationUrl)) {
    return done(new Error(errorPrefix + '"authorizationUrl" is missing'));
  }

  var width       = 720;
  var height      = 480;
  var left        = (window.screen.availWidth - width) / 2;
  var state       = ('' + Math.random()).substr(2);
  var redirectUri = url.resolve(
    global.location.href, '/authentication/oauth2.html'
  );

  // Stringify the query string data.
  var query  = qs.stringify({
    'state':         state,
    'scope':         options.scopes.join(' '),
    'client_id':     options.clientId,
    'redirect_uri':  redirectUri,
    'response_type': 'code'
  });

  // Close any previously open popup.
  if (openPopup) {
    openPopup.close();
  }

  openPopup = window.open(
    options.authorizationUrl + '?' + query,
    'authenticateOauth2',
    'left=' + left + ',top=100,width=' + width + ',height=' + height
  );

  if (!_.isObject(openPopup)) {
    return done(new Error(errorPrefix + 'Popup window blocked'));
  }

  // Catch the client closing the window before authentication is complete.
  var closeInterval = window.setInterval(function () {
    if (openPopup.closed) {
      window.clearInterval(closeInterval);
      return done(new Error(errorPrefix + 'Authentication Cancelled'));
    }
  }, 300);

  /**
   * Assigns a global variable that the oauth authentication window should
   * be able to access and send the callback data.
   */
  global.authenticateOauth2 = function (href) {
    openPopup = null;
    delete global.authenticateOauth2;
    window.clearInterval(closeInterval);

    // Parse the url and prepare to do an ajax request to get the acces token.
    var query = url.parse(href, true).query;

    if (erroredResponse(query)) {
      return done(new Error(errorPrefix + erroredResponse(query)));
    }

    if (query.state !== state) {
      return done(new Error(errorPrefix + 'State mismatch'));
    }

    if (!query.code) {
      return done(new Error(errorPrefix + 'Response code missing'));
    }

    App.middleware.trigger('ajax', {
      url: options.accessTokenUrl,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
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
      if (err) {
        return done(err);
      }

      var response = JSON.parse(xhr.responseText);

      // Repond with the error body.
      if (erroredResponse(response)) {
        return done(new Error(errorPrefix + erroredResponse(response)));
      }

      var data = {
        scopes:      options.scopes,
        accessToken: response.access_token
      };

      if (response.token_type) {
        data.tokenType = response.token_type;
      }

      if (+response.expires_in) {
        data.expires = Date.now() + (response.expires_in * 1000);
      }

      // Persist the auth data in localStorage.
      oauth2Store.set(tokenKey(options), data);

      return done(null, data);
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
 * Register oauth2 based middleware. Handles oauth2 implicit auth flow, and the
 * normal oauth2 authentication flow when using the notebook proxy server.
 *
 * @param {Object} middleware
 */
module.exports = function (middleware) {
  /**
   * Trigger authentication via OAuth2 in the browser. Valid data properties:
   *
   *   `accessTokenUrl`      - "https://www.example.com/oauth2/token"
   *   `authorizationUrl`    - "https://www.example.com/oauth2/authorize"
   *   `clientId`            - EXAMPLE_CLIENT_ID
   *   `clientSecret`        - EXAMPLE_CLIENT_SECRET
   *   `authorizationGrants` - ["code"]
   *   `scopes`              - ["user", "read", "write"]
   *   `validateUrl`         - "http://www.example.com/user/self"
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('authenticate:oauth2', function (data, next, done) {
    var options = sanitizeOptions(data);

    return middleware.trigger(
      'authenticate:oauth2:validate',
      options,
      function (err, auth) {
        // Break before doing the Oauth2 dance if we received an auth object.
        if (err || auth) {
          return done(err, auth);
        }

        // Use insection to get the accepted grant types in the order of the
        // supported grant types (which are ordered by preference).
        var grantType = _.intersection(
          supportedGrants, options.authorizationGrants
        )[0];

        if (!grantType) {
          return done(new Error('Unsupported OAuth2 Grant Flow'));
        }

        // Commit to the whole OAuth2 dance using the accepted grant type.
        return middleware.trigger(
          'authenticate:oauth2:' + grantType, options, done
        );
      }
    );
  });

  /**
   * Middleware for checking if the OAuth2 token is valid without actually
   * triggering the OAuth2 flow.
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('authenticate:oauth2:validate', function (data, next, done) {
    return validateToken(sanitizeOptions(data), proxyDone(done));
  });

  /**
   * Middleware for authenticating using the Oauth2 code grant flow.
   * Reference: http://tools.ietf.org/html/rfc6749#section-4.1
   *
   * @param  {Object}   data
   * @param  {Function} next
   * @param  {Function} done
   */
  middleware.core('authenticate:oauth2:code', function (data, next, done) {
    return oAuth2CodeFlow(sanitizeOptions(data), proxyDone(done));
  });

  /**
   * Add a new ajax flow for oauth2-based URLs.
   *
   * @param {Object}   data
   * @param {Function} next
   * @param {Function} done
   */
  middleware.core('ajax:oauth2', function (data, next, done) {
    if (!_.isObject(data.oauth2) || !data.oauth2.authorizationUrl) {
      throw new Error('OAuth2 XHR: "authorizationUrl" is missing');
    }

    var auth = oauth2Store.get(tokenKey(data.oauth2));

    if (_.isObject(auth)) {
      if (auth.tokenType === 'bearer') {
        data.headers = _.extend({
          'Authorization': 'Bearer ' + auth.accessToken
        }, data.headers);
      } else {
        // Add the access token to the request.
        var uri = url.parse(data.url, true);
        uri.query.access_token = auth.accessToken;

        // Update ajax data.
        data.url = url.format(uri);
        data.headers = _.extend({
          'Cache-Control': 'no-store'
        }, data.headers);
      }
    }

    // Trigger the regular ajax method.
    return middleware.trigger('ajax', data, done);
  });
};
