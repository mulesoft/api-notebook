/* global App */
var OAUTH_KEY = 'github-oauth';
var CLIENT_ID = process.env.GITHUB_CLIENT_ID;
var AUTH_URL  = 'https://github.com/login/oauth/authorize';
var TOKEN_URL = 'https://github.com/login/oauth/access_token';
var VALID_URL = 'https://api.github.com/user';

/**
 * Any time a change occurs, we'll sync the change with our Github gist.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var changePlugin = function (data, next, done) {
  return data.save(done);
};

/**
 * Get the authenticated user id.
 *
 * @param {Function} done
 */
var authenticatedUserId = function (done) {
  App.middleware.trigger('authenticate:oauth2:validate', {
    validateUrl:      VALID_URL,
    authorizationUrl: AUTH_URL
  }, function (err, auth) {
    if (err || !auth) {
      return done(err);
    }

    return done(null, JSON.parse(auth.xhr.responseText).id);
  });
};

/**
 * Authenticate with the github oauth endpoint. Since we are unlikely to include
 * our client secret with the client code, you'll probably want to include the
 * proxy plugin (`./proxy.js`).
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var authenticatePlugin = function (data, next, done) {
  App.middleware.trigger('authenticate:oauth2', {
    scopes:           ['gist'],
    clientId:         CLIENT_ID,
    clientSecret:     '', // Replaced by proxy
    validateUrl:      VALID_URL,
    accessTokenUrl:   TOKEN_URL,
    authorizationUrl: AUTH_URL
  }, function (err, auth) {
    if (err) {
      return done(err);
    }

    authenticatedUserId(function (err, userId) {
      data.userId = userId;
      return done(err);
    });
  });
};

/**
 * Check that we are authenticated with Github.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var authenticatedPlugin = function (data, next, done) {
  authenticatedUserId(function (err, userId) {
    data.userId = userId;
    return done(err);
  });
};

/**
 * Load a single gist from Github and make sure it holds our notebook content.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var loadPlugin = function (data, next, done) {
  if (!data.id) {
    return next();
  }

  App.middleware.trigger('ajax', {
    url: 'https://api.github.com/gists/' + data.id,
    method: 'GET'
  }, function (err, xhr) {
    var content = JSON.parse(xhr.responseText);

    if (!content || !content.files || !content.files['notebook.md']) {
      return next();
    }

    data.id       = content.id;
    data.ownerId  = content.user && content.user.id;
    data.contents = content.files['notebook.md'].content;
    return done();
  });
};

/**
 * Save the notebook into a Github gist for persistence.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var savePlugin = function (data, next, done) {
  if (!data.isAuthenticated()) {
    return next();
  }

  App.middleware.trigger('ajax:oauth2', {
    url: 'https://api.github.com/gists' + (data.id ? '/' + data.id : ''),
    method: data.id ? 'PATCH' : 'POST',
    data: JSON.stringify({
      files: {
        'notebook.md': {
          content: data.contents
        }
      }
    }),
    oauth2: {
      authorizationUrl: AUTH_URL
    }
  }, function (err, xhr) {
    if (err) {
      return done(err);
    }

    var content = JSON.parse(xhr.responseText);
    data.id      = content.id;
    data.ownerId = content.user && content.user.id;
    return done();
  });
};

/**
 * A { key: function } map of all middleware used in the plugin.
 *
 * @type {Object}
 */
var plugins = {
  'persistence:change':        changePlugin,
  'persistence:authenticate':  authenticatePlugin,
  'persistence:authenticated': authenticatedPlugin,
  'persistence:load':          loadPlugin,
  'persistence:save':          savePlugin
};

/**
 * Registers all the neccessary handlers for Github gist persistence.
 *
 * @param {Object} middleware
 */
exports.attach = function (middleware) {
  middleware.use(plugins);
};

/**
 * Detaches all middleware used by gist persistence.
 *
 * @param {Object} middleware
 */
exports.detach = function (middleware) {
  middleware.disuse(plugins);
};
