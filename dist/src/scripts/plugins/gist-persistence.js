/* global App */
var _             = App._;
var AUTH_URL      = 'https://github.com/login/oauth/authorize';
var TOKEN_URL     = 'https://github.com/login/oauth/access_token';
var plugin        = (process.env.plugins || {}).github || {};
var CLIENT_ID     = plugin.clientId;
var CLIENT_SECRET = plugin.clientSecret;

// Detect if the plugin is not enabled.
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('GitHub plugin has not been configured. Please set the ' +
    '`clientId` and `clientSecret` in your config to use it.');
}

/**
 * OAuth2 authentication options object.
 *
 * @type {Object}
 */
var AUTH_OPTIONS = {
  scopes:              ['gist'],
  type:                'OAuth 2.0',
  clientId:            CLIENT_ID,
  clientSecret:        CLIENT_SECRET,
  accessTokenUri:      TOKEN_URL,
  authorizationUri:    AUTH_URL,
  authorizationGrants: 'code',
  modal: {
    title: 'Authenticate Notebook',
    content: [
      '<p>Notebooks are saved as gists to your GitHub account.</p>',
      '<p>',
      'Please authorize this application in order to ',
      'save, edit, and share your notebooks.',
      '</p>'
    ].join('\n'),
    btnText: 'Authorize With GitHub'
  }
};

/**
 * Check whether a gist contents are a valid notebook.
 *
 * @param  {Object}  content
 * @return {Boolean}
 */
var isNotebookContent = function (content) {
  return content && content.files && content.files['notebook.md'];
};

/**
 * Parse the link header for the specific links.
 *
 * @param  {String} header
 * @return {Object}
 */
var parseLinkHeader = function (header) {
  var obj = {};

  _.each(header.split(', '), function (part) {
    var matches = /^<([^>]+)>; *rel="([^"]+)"$/.exec(part);
    return matches && (obj[matches[2]] = matches[1]);
  });

  return obj;
};

/**
 * Generate a custom store for the Github OAuth2 response tokens.
 *
 * @type {Object}
 */
var oauth2Store = App.store.customStore('github');

/**
 * Make saves to the server less frequently. Handles multiple notebooks saving
 * concurrently.
 *
 * @type {Function}
 */
var debounceSave = (function (hash) {
  return function (data) {
    // Remove any previously queued save request for the same resource.
    if (hash[data.id]) {
      clearTimeout(hash[data.id]);
      delete hash[data.id];
    }

    hash[data.id] = setTimeout(function () {
      return data.shouldSave() && data.save();
    }, 600);
  };
})({});

/**
 * When a change occurs *and* we are already authenticated, we can automatically
 * save the update to a gist.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var changePlugin = function (data, next, done) {
  debounceSave(data);

  return done();
};

/**
 * Get the authenticated user id and title by making a request on the users
 * behalf.
 *
 * @param {Function} done
 */
var authenticatedUserId = function (done) {
  if (!oauth2Store.has('accessToken')) {
    return done(new Error('No access token'));
  }

  // Make a request to the check authorization url, which doesn't incur any
  // rate limiting penalties.
  App.middleware.trigger('ajax:basicAuth', {
    url: 'https://api.github.com/applications/' + CLIENT_ID + '/tokens/' +
      oauth2Store.get('accessToken'),
    proxy: false,
    basicAuth: {
      username: CLIENT_ID,
      password: CLIENT_SECRET
    }
  }, function (err, xhr) {
    var content;

    // Proxy any errors back to the user.
    if (err) { return done(err); }

    // Check if the connection was rejected because of invalid credentials.
    if (xhr.status === 404) {
      oauth2Store.clear();
      return done(new Error('Invalid credentials'));
    }

    try {
      content = JSON.parse(xhr.responseText);
    } catch (e) {
      return done(e);
    }

    return done(null, {
      userId:    content.user.id,
      userTitle: content.user.login
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
  App.middleware.trigger('authenticate', AUTH_OPTIONS, function (err, auth) {
    if (err) { return next(err); }

    oauth2Store.set(auth);

    return authenticatedUserId(done);
  });
};

/**
 * Unauthenticate the user.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var unauthenticatePlugin = function (data, next, done) {
  oauth2Store.clear();

  return done();
};

/**
 * Check whether we are authenticated to Github.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var authenticatedPlugin = function (data, next, done) {
  return authenticatedUserId(done);
};

/**
 * Loads a single gist id from Github and checks whether it holds our notebook.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var loadPlugin = function (data, next, done) {
  if (!data.id) {
    return next();
  }

  App.middleware.trigger('ajax:oauth2', {
    // Add the application client id and secret to load requests to avoid rate
    // limiting in the case that the user is unauthenticated.
    url:    'https://api.github.com/gists/' + data.id + '?_=' + Date.now(),
    proxy:  false,
    method: 'GET',
    oauth2: oauth2Store.toJSON()
  }, function (err, xhr) {
    var content;

    try {
      content = JSON.parse(xhr.responseText);
    } catch (e) {
      return next(e);
    }

    if (!isNotebookContent(content)) {
      return next(new Error('Unexpected notebook response'));
    }

    data.id         = content.id;
    data.ownerId    = content.owner.id;
    data.ownerTitle = content.owner.login;
    data.content    = content.files['notebook.md'].content;
    data.updatedAt  = new Date(content.updated_at);
    return done();
  });
};

/**
 * Save the notebook into a single Github gist for persistence. If the user is
 * not yet authenticated, we'll attempt to do a smoother on boarding by showing
 * a help dialog.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var savePlugin = function (data, next, done) {
  if (!data.isAuthenticated()) {
    return data.authenticate(function (err) {
      if (err) { return next(err); }

      return done(), data.save();
    });
  }

  App.middleware.trigger('ajax:oauth2', {
    url:    'https://api.github.com/gists' + (data.id ? '/' + data.id : ''),
    proxy:  false,
    method: data.id ? 'PATCH' : 'POST',
    data: JSON.stringify({
      description: data.meta.title,
      files: {
        'notebook.md': {
          content: data.content
        }
      }
    }),
    oauth2: oauth2Store.toJSON()
  }, function (err, xhr) {
    if (err) { return next(err); }

    // The status does not equal a sucessful patch or creation.
    if (xhr.status !== 200 && xhr.status !== 201) {
      return next(new Error('Request failed'));
    }

    try {
      var content = JSON.parse(xhr.responseText);
      data.id         = content.id;
      data.ownerId    = content.owner.id;
      data.ownerTitle = content.owner.login;
    } catch (e) {
      return next(e);
    }

    return done();
  });
};

/**
 * Push all suitable gists into the list of notebooks.
 *
 * @param {Array}    list
 * @param {Function} next
 * @param {Function} done
 */
var listPlugin = function (list, next, done) {
  if (!oauth2Store.has('accessToken')) {
    return done(new Error('Listing notebooks requires authentication'));
  }

  (function recurse (link) {
    App.middleware.trigger('ajax:oauth2', {
      url:    link + (link.indexOf('?') > -1 ? '&' : '?') + '_=' + Date.now(),
      proxy:  false,
      method: 'GET',
      oauth2: oauth2Store.toJSON()
    }, function (err, xhr) {
      if (err) { return done(err); }

      var nextLink = parseLinkHeader(xhr.getResponseHeader('link') || '').next;
      var response;

      try {
        response = JSON.parse(xhr.responseText);
      } catch (e) {
        return next(e);
      }

      if (typeof response !== 'object') {
        return next(new Error('Unexpected response'));
      }

      _.each(response, function (content) {
        if (!isNotebookContent(content)) { return; }

        list.push({
          id: content.id,
          updatedAt: new Date(content.updated_at),
          meta: {
            title: content.description
          }
        });
      });

      // Proceed to the next link or return done.
      return nextLink ? recurse(nextLink) : done();
    });
  })('https://api.github.com/gists');
};

/**
 * Delete a single notebook from Github gists.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
var removePlugin = function (data, next, done) {
  return App.middleware.trigger('ajax:oauth2', {
    url:    'https://api.github.com/gists/' + data.id,
    proxy:  false,
    method: 'DELETE',
    oauth2: oauth2Store.toJSON()
  }, done);
};

/**
 * Set the config option for the authentication text.
 */
App.config.set('authenticateText', 'Connect using Github');

/**
 * A { key: function } map of all middleware used in the plugin.
 *
 * @type {Object}
 */
module.exports = {
  'persistence:change':         changePlugin,
  'persistence:authenticate':   authenticatePlugin,
  'persistence:unauthenticate': unauthenticatePlugin,
  'persistence:authenticated':  authenticatedPlugin,
  'persistence:load':           loadPlugin,
  'persistence:save':           savePlugin,
  'persistence:list':           listPlugin,
  'persistence:remove':         removePlugin
};
