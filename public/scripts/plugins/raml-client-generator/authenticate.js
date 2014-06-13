/* global App */
var _     = App.Library._;
var async = App.Library.async;

/**
 * Map authentication types to automatic preference.
 *
 * @type {Array}
 */
var ORDER_PREFERENCE = ['OAuth 2.0', 'OAuth 1.0', 'Basic Authentication'];

/**
 * Returns an object of available keys and whether they are required.
 *
 * @param  {Object} scheme
 * @return {Object}
 */
var requiredTokens = function (scheme) {
  var keys = _.extend({}, requiredTokens.defaults[scheme.type]);

  // Special case is required for OAuth2 implicit auth flow.
  if (scheme.type === 'OAuth 2.0') {
    keys.clientSecret = !_.contains(
      scheme.settings.authorizationGrants, 'token'
    );
  }

  return keys;
};

/**
 * Sanitize scopes to be an array.
 *
 * @param  {*}     scopes
 * @return {Array}
 */
var sanitizeScope = function (scopes) {
  if (_.isString(scopes)) {
    return scopes.split(' ');
  }

  if (!Array.isArray(scopes)) {
    return [];
  }

  return scopes;
};

/**
 * Required authentication keys used to check the options object.
 *
 * @type {Object}
 */
requiredTokens.defaults = {
  'OAuth 1.0': {
    consumerKey:    true,
    consumerSecret: true
  },
  'OAuth 2.0': {
    clientId:     true,
    clientSecret: true
  },
  'Basic Authentication': {
    username: true,
    password: true
  }
};

/**
 * Check the tokens object against the required tokens.
 *
 * @param  {Object}  scheme
 * @param  {Object}  tokens
 * @return {Boolean}
 */
var hasRequiredTokens = function (scheme, tokens) {
  // Iterate over the required tokens and check that the token is defined.
  return _.every(requiredTokens(scheme), function (value, key) {
    return value ? tokens[key] : true;
  });
};

/**
 * Prompt the user for authentication tokens based on a scheme. We can pass in
 * the current options object to help decide what data to display to the user.
 *
 * @param {Object}   scheme
 * @param {Object}   options
 * @param {Function} done
 */
var promptTokens = function (scheme, options, done) {
  var cancelled   = true;
  var needsTokens = requiredTokens(scheme);

  // Generate an array of the tokens to use with our prompt and filter
  // explicitly not required tokens.
  var possibleTokens = _.filter(
    promptTokens.possibleTokens[scheme.type],
    function (token) {
      return needsTokens[token] !== false;
    }
  );

  // Multiple ways of setting the scope option.
  options.scopes = sanitizeScope(options.scope || options.scopes);
  delete options.scope;

  // Generate the form to prompt the user with.
  var promptForm = _.map(possibleTokens, function (key) {
    if (key === 'scopes') {
      var scopes = sanitizeScope(scheme.settings.scopes);

      // Ignore the scopes selection when nothing is available for selection.
      if (!scopes.length) {
        return '';
      }

      // Map scopes to checkbox selections.
      var scopeOptions = _.map(scopes, function (scope) {
        // Check if the scope is already in the selected scopes. If there is
        // only one possible scope, just select it by default anyway.
        var hasScope = _.contains(options.scopes, scope) || scopes.length === 1;

        return [
          '<div class="checkbox">',
          '<label>',
          '<input type="checkbox" id="scopes" value="' + scope + '" ' +
            (hasScope ? 'checked' : '') + '>',
          scope,
          '</label>',
          '</div>'
        ].join('');
      }).join('\n');

      return [
        '<div class="form-group">',
        '<label class="form-label">' + promptTokens.titles[key] + '</label>',
        '<div class="form-content">' + scopeOptions + '</div>',
        '</div>'
      ].join('\n');
    }

    // By default we show the user an input field to input their keys.
    return [
      '<div class="form-group">',
      '<label for="' + key + '" class="form-label">',
      promptTokens.titles[key],
      '</label>',
      '<div class="form-content">',
      '<input id="' + key + '" value="' + (options[key] || '') + '">',
      '</div>',
      '</div>'
    ].join('');
  }).join('\n');

  return App.middleware.trigger('ui:modal', {
    title: promptTokens.prompts[scheme.type],
    content: [
      '<p>',
      'This API requires authentication. Please enter your application keys.',
      '</p>',
      '<p><em>We will not store your keys.</em></p>',
      '<form>',
      promptForm,
      '<div class="form-footer">',
      '<button type="submit" class="btn btn-primary">Submit</button>',
      '</div>',
      '</form>'
    ].join('\n'),
    show: function (modal) {
      modal.el.querySelector('form')
        .addEventListener('submit', function (e) {
          e.preventDefault();

          _.each(this.querySelectorAll('input'), function (el) {
            var name = el.getAttribute('id');

            if (name === 'scopes') {
              var indexOf = _.indexOf(options.scopes, el.value);

              if (el.checked) {
                if (indexOf < 0) {
                  options.scopes.push(el.value);
                }
              } else {
                if (indexOf > -1) {
                  options.scopes.splice(indexOf, 1);
                }
              }
            } else {
              options[name] = el.value.trim();
            }
          });

          cancelled = false;
          modal.close();
        });
    }
  }, function (err) {
    return done(err || (cancelled ? new Error('Modal closed') : null), options);
  });
};

/**
 * Default authentication prompt titles.
 *
 * @type {Object}
 */
promptTokens.prompts = {
  'OAuth 1.0':            'Please Enter Your OAuth 1.0 Keys',
  'OAuth 2.0':            'Please Enter Your OAuth 2.0 Keys',
  'Basic Authentication': 'Please Enter Your Username and Password'
};

/**
 * Map of object keys to their readable names.
 *
 * @type {Object}
 */
promptTokens.titles = {
  consumerKey:    'Consumer Key',
  consumerSecret: 'Consumer Secret',
  clientId:       'Client ID',
  clientSecret:   'Client Secret',
  scopes:         'Permissions',
  username:       'Username',
  password:       'Password'
};

/**
 * Possible tokens to be filled out by the user.
 *
 * @type {Object}
 */
promptTokens.possibleTokens = {
  'OAuth 1.0':            ['consumerKey', 'consumerSecret'],
  'OAuth 2.0':            ['clientId', 'clientSecret', 'scopes'],
  'Basic Authentication': ['username', 'password']
};

/**
 * Authenticate using an authentication scheme and passed in options.
 *
 * @param  {Object}   scheme
 * @param  {Object}   options
 * @param  {Function} done
 */
var authenticate = function (scheme, options, done) {
  App.middleware.trigger('authenticate', _.extend({
    type: scheme.type
  }, scheme.settings, options), function (err, tokens) {
    if (!tokens) {
      return done(new Error('Authentication failed'));
    }

    return done(err, scheme, options, tokens);
  }, true);
};

/**
 * Request authentication credentials from a third-party source.
 *
 * @param {Object}   scheme
 * @param {Function} done
 */
var requestTokens = function (scheme, done) {
  return App.middleware.trigger('ramlClient:token', scheme, done, true);
};

/**
 * Return the preferred scheme option from an object of every scheme.
 *
 * @param  {Object} schemes
 * @return {Object}
 */
var preferredScheme = function (schemes) {
  var method = _.intersection(ORDER_PREFERENCE, _.pluck(schemes, 'type'))[0];

  // Return an essentially random but consistent scheme.
  if (!method) {
    return schemes[_.keys(schemes)[0]];
  }

  // Find the scheme that matched our preferred method.
  return _.find(schemes, function (scheme) {
    return scheme.type === method;
  });
};

/**
 * Retrieve authentication tokens and method any way possible. It will attempt
 * to resolve automatically. If that is not possible, it will defer to
 * prompting the user.
 *
 * @param {Object}   schemes
 * @param {Function} done
 */
var retrieveTokens = function (schemes, done) {
  var tokens;

  // Attempt to get the first resolving set of access tokens.
  async.detectSeries(_.map(schemes, function (secured, method) {
    return schemes[method];
  }), function (scheme, cb) {
    return requestTokens(scheme, function (err, data) {
      if (err || !data || !hasRequiredTokens(scheme, data)) {
        return cb(false);
      }

      return cb(tokens = data);
    });
  }, function (scheme) {
    if (!scheme) {
      scheme = preferredScheme(schemes);

      return promptTokens(scheme, {}, function (err, tokens) {
        return done(err, scheme, tokens);
      });
    }

    return done(null, scheme, tokens);
  });
};

/**
 * Attempt to magically resolve to the first working authentication method. If
 * we fail, we need to fall back to manual authentication options with the
 * optimal authentication scheme available.
 *
 * @param {Object}   schemes
 * @param {Function} done
 */
var resolveScheme = function (schemes, done) {
  return retrieveTokens(schemes, function (err, scheme, tokens) {
    if (err) { return done(err); }

    return authenticate(scheme, tokens, done);
  });
};

/**
 * Export a function that will contain all the logic for automagically
 * selecting an appropriate authentication method and prompting the user
 * for the following steps.
 *
 * @param {Object}   schemes
 * @param {String}   method
 * @param {Object}   options
 * @param {Function} done
 */
module.exports = function (schemes, method, options, done) {
  // If no authentication method has been passed in, attempt to pick our own.
  if (!method) {
    return resolveScheme(schemes, done);
  }

  // Ensure we are attempting to authenticate with a valid method.
  if (!Object.prototype.hasOwnProperty.call(schemes, method)) {
    return done(new Error(
      'The only available authentication methods are: ' +
      _.keys(schemes).map(JSON.stringify).join(', ')
    ));
  }

  var scheme = schemes[method];
  var auth   = _.extend({}, options);

  // If we don't have all the required tokens available, prompt the user to
  // input tokens and continue authenticating.
  if (!hasRequiredTokens(scheme, auth)) {
    return requestTokens(scheme, function (err, data) {
      if (err) { return done(err); }

      // Don't prompt for the tokens if we managed to retrieve them anyway.
      if (hasRequiredTokens(scheme, _.extend(auth, data))) {
        return authenticate(scheme, auth, done);
      }

      return promptTokens(scheme, auth, function (err, tokens) {
        if (err) { return done(err); }

        return authenticate(scheme, tokens, done);
      });
    });
  }

  // Finally we have everything we need and can initiate authentication.
  return authenticate(scheme, auth, done);
};
