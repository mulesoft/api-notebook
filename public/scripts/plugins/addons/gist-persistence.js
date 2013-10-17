/* global App */
var _            = App._;
var OAUTH_KEY    = 'github-oauth';
var CLIENT_ID    = process.env.GITHUB_CLIENT_ID;
var AUTH_URL     = 'https://github.com/login/oauth/authorize';
var TOKEN_URL    = 'https://github.com/login/oauth/access_token';
var VALIDATE_URL = 'https://api.github.com/user';

/**
 * Generate a custom store for the Github token.
 *
 * @type {Object}
 */
var oauth2Store = App.store.customStore('github');

/**
 * Any time a change occurs, we'll sync the change with our Github gist.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var changePlugin = function (data, next, done) {
  return setTimeout(_.bind(data.save, null, done), 500);
};

/**
 * Get the authenticated user id.
 *
 * @param {Function} done
 */
var authenticatedUserId = function (done) {
  App.middleware.trigger('ajax:oauth2', {
    url:    VALIDATE_URL,
    oauth2: oauth2Store.toJSON()
  }, function (err, xhr) {
    var content;

    if (err) { return done(err); }

    try {
      content = JSON.parse(xhr.responseText);
    } catch (e) {
      return done(e);
    }

    return done(null, {
      userId:    content.id,
      userTitle: content.login + ' @ Github'
    });
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
    scopes:              ['gist'],
    clientId:            CLIENT_ID,
    clientSecret:        '', // Injected by proxy
    accessTokenUrl:      TOKEN_URL,
    authorizationUrl:    AUTH_URL,
    authorizationGrants: 'code'
  }, function (err, auth) {
    if (err) { return next(err); }

    oauth2Store.set(auth);

    return authenticatedUserId(done);
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
  return authenticatedUserId(done);
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
    var content;

    try {
      content = JSON.parse(xhr.responseText);
    } catch (e) {
      return next(e);
    }

    if (!content || !content.files || !content.files['notebook.md']) {
      return next(new Error('Unexpected JSON response'));
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
    oauth2: oauth2Store.toJSON()
  }, function (err, xhr) {
    if (err) {
      return next(err);
    }

    // The status does not equal a sucessful patch or creation.
    if (xhr.status !== 200 && xhr.status !== 201) {
      return next(new Error('Request failed'));
    }

    try {
      var content = JSON.parse(xhr.responseText);
      data.id      = content.id;
      data.ownerId = content.user && content.user.id;
    } catch (e) {
      return next(e);
    }

    return next();
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
