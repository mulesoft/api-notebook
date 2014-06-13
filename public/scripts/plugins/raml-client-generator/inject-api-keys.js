/* global App */
var apiKeys = process.env.plugins.ramlClient;

/**
 * Check against our OAuth tokens and inject the tokens we have available.
 *
 * @param {Object}   data
 * @param {Function} next
 */
App.middleware.register('ramlClient:token', function (scheme, next, done) {
  var authUri = scheme.settings.authorizationUri;

  if (scheme.type === 'OAuth 1.0' && apiKeys.oauth1[authUri]) {
    return done(null, apiKeys.oauth1[authUri]);
  }

  if (scheme.type === 'OAuth 2.0' && apiKeys.oauth2[authUri]) {
    return done(null, apiKeys.oauth2[authUri]);
  }

  return next();
});
