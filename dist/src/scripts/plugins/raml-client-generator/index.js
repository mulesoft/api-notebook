/* global App */
var _               = App._;
var ramlParser      = require('raml-1-parser');
var authenticate    = require('./authenticate');
var clientGenerator = require('./client-generator');
var fromPath        = require('../../lib/from-path');

/**
 * Implementation helpers.
 */
require('./inject-api-keys');
require('./insert-api-client');

/**
 * Provided a special documentation property for functionsw with another plugin.
 *
 * @type {String}
 */
var DESCRIPTION_PROPERTY = '!description';

/**
 * The Api object is used in the execution context.
 *
 * @type {Object}
 */
var API = {};

/**
 * Responsible for loading RAML documents and return API clients.
 *
 * @param {String}   name
 * @param {String}   uri
 * @param {Object}   [config]
 * @param {Function} done
 */
API.createClient = function (name, uri, config, done) {
  if (!_.isString(name)) {
    throw new Error('Provide a name for the generated client');
  }

  if (!_.isString(uri)) {
    throw new Error('Provide a URL for the ' + name + ' RAML document');
  }

  // Allow the config object to be skipped.
  if (typeof config === 'function') {
    done   = arguments[2];
    config = {};
  }

  App._executeContext.timeout(Infinity);
  done   = done   || App._executeContext.async();
  config = config || {};

  /**
   * Clean path when error happens while creating new client.
   */
  var cleanPath = function cleanPath() {
    var path = name.split('.');
    App._executeWindow = App._executeWindow[path[path.length - 1]] = {};
  };

  /**
   * Generate and attach the RAML client from RAML.
   *
   * @param  {Object} raml
   */
  var createClient = function (raml) {
    try {
      fromPath(
        App._executeWindow, name.split('.'), clientGenerator(raml, config)
      );
    } catch (e) {
      return done(e);
    }

    return done(
      null,
      'Create a new code cell and type "' + name + '." to explore this API.'
    );
  };

  /**
   * API with traits and resource types expanded.
   *
   * @param  {Object} api
   */
  var expandApi = function(api) {
    api = api.expand ? api.expand(true) : api;

    var jsonOptions = {
      serializeMetadata: false,
      dumpSchemaContents: false,
      rootNodeDetails: false
    };
    return api.toJSON(jsonOptions);
  };

  /**
   * Manually initialize the first ajax request to support JSON responses.
   */
  return App.middleware.trigger('ajax', {
    url:   uri,
    proxy: config.proxy,
    headers: {
      'Accept': 'application/raml+yaml, application/json, */*'
    }
  }, function (err, xhr) {
    if (err) {
      cleanPath();
      return done(err);
    }

    if (Math.floor(xhr.status / 100) !== 2) {
      cleanPath();
      return done(new Error('HTTP ' + xhr.status));
    }

    // Support JSON responses. Originally this checked the response content
    // types, etc. but it's just as easy to attempt parsing as JSON and if it
    // fails pass it onto the raml parser.
    try {
      return createClient(JSON.parse(xhr.responseText));
    } catch (e) {}

    var ramlParserConfig = {
      attributeDefaults: true,
      rejectOnErrors:    false
    };

    // Pass our url to the RAML parser for processing and transform the promise
    // back into a callback format.
    return ramlParser.loadApi(uri, ramlParserConfig)
        .then(expandApi,
            function (err) {
                var amountOfErrors =
                    (err.parserErrors ? ' There are ' + err.parserErrors.length + ' errors/warnings.' : '');
                throw new Error(err.message + amountOfErrors);
            })
        .then(createClient, done);
  });

};

/**
 * Description of the create client function.
 */
API.createClient[DESCRIPTION_PROPERTY] = {
  '!type': 'fn(alias, url, options?, cb?)',
  '!args': [{
    '!type': 'string'
  }, {
    '!type': 'string'
  }, {
    '!type': 'object',
    '!doc': [
      'Initialize the client with default config options. Valid options:',
      '* **proxy**: Set to a custom proxy or `false` to disable entirely',
      '* **body**: Set a fallback request body',
      '* **uriParameters**: Set fallback uri parameters to inject',
      '* **baseUri:** Override the base uri',
      '* **baseUriParameters**: Inject base uri parameters to override',
      '* **headers**: Set default headers to send with every request',
      '* **query**: Set a default query string to send with every request'
    ].join('\n')
  }, {
    '!type': 'fn(error, client)',
    '!doc': [
      'Pass in a custom callback to run when the client has loaded.'
    ].join('\n')
  }],
  '!doc': [
    'Generate an API client from a RAML document and alias it on the window.'
  ].join(' ')
};

/**
 * Set a configuration value on a client.
 *
 * @param {Function} client
 * @param {String}   key
 * @param {*}        value
 */
API.set = function (client, key, value) {
  // If we don't have enough arguments for a key and value, assume we have
  // a fresh configuration object.
  if (arguments.length < 3) {
    return _.extend(client['!config'], key);
  }

  return client['!config'][key] = value;
};

/**
 * Set the description of the API client configuration setter.
 */
API.set[DESCRIPTION_PROPERTY] = {
  '!type': 'fn(client, key, value)',
  '!args': [{
    '!type': 'fn()',
    '!doc': 'A function generated by `API.createClient`.'
  }, {
    '!type': 'string'
  }],
  '!doc': 'Set a configuration option of a RAML API client.'
};

/**
 * Retrieve a value from the client config object.
 *
 * @param  {Function} client
 * @param  {String}   key
 * @return {*}
 */
API.get = function (client, key) {
  if (arguments.length < 2) {
    return client['!config'];
  }

  return client['!config'][key];
};

/**
 * Set the description of the API client configuration getter.
 */
API.get[DESCRIPTION_PROPERTY] = {
  '!type': 'fn(client, key)',
  '!args': [{
    '!type': 'fn()',
    '!doc': 'A function generated by `API.createClient`.'
  }, {
    '!type': 'string'
  }],
  '!doc': 'Get a configuration option from a RAML API client.'
};

/**
 * Unset a key from the client configuration.
 *
 * @param  {Function} client
 * @param  {String}   key
 * @return {Boolean}
 */
API.unset = function (client, key) {
  if (arguments.length < 2) {
    _.each(client['!config'], function (value, key, obj) {
      delete obj[key];
    });

    return true;
  }

  return delete client['!config'][key];
};

/**
 * Set the description of the API client configuration unsetter.
 */
API.unset[DESCRIPTION_PROPERTY] = {
  '!type': 'fn(client, key)',
  '!args': [{
    '!type': 'fn()',
    '!doc': 'A function generated by `API.createClient`.'
  }, {
    '!type': 'string'
  }],
  '!doc': 'Unset a configuration option from a RAML API client.'
};

/**
 * Authenticate a RAML API client passing an optional method and accompanying
 * options object.
 *
 * @param {Function} client
 * @param {String}   method
 * @param {Object}   options
 * @param {Function} done
 */
API.authenticate = function (client, method, options, done) {
  App._executeContext.timeout(10 * 60 * 1000);
  done = done || App._executeContext.async();

  var clientOption    = client['!client'];
  var securitySchemes = clientOption.securitySchemes;

  // Extend passed in options with global options (for `baseUriParameters`).
  options = _.extend({}, options, client['!config']);

  /**
   * The callback is used to handle the persistence of data to the client.
   *
   * @param  {Error}    err
   * @param  {Object}   scheme
   * @param  {Object}   options
   * @param  {Object}   tokens
   * @return {Function}
   */
  var cb = function (err, scheme, options, tokens) {
    if (err) {
      return done(err);
    }

    // Alias onto the client object for future use.
    clientOption.authentication[scheme.type] = _.extend({}, options, tokens);

    // Set private fields to asterisks of an arbitrary length.
    _.each(tokens, function (value, key) {
      if (authenticate.SECRET_FIELDS[key]) {
        tokens[key] = new Array(Math.ceil(value.length / 5) * 5).join('*');
      }
    });

    return done(null, tokens);
  };

  return authenticate(securitySchemes, method, options, cb);
};

/**
 * Set the description of the API client authenticator.
 */
API.authenticate[DESCRIPTION_PROPERTY] = {
  '!type': [
    'fn(client, method?, options?, cb?)'
  ].join(''),
  '!args': [{
    '!type': 'fn()',
    '!doc': 'A function generated by `API.createClient`.'
  }, {
    '!type': 'string',
    '!doc': 'Select an authentication method defined in the RAML file.'
  }, {
    '!type': 'object',
    '!doc': 'Override the default selected authentication method options.'
  }, {
    '!type': 'fn(error, response)'
  }],
  '!doc': [
    'Authentication parameters are optional. For popular APIs, we provide',
    'keys. If we need your keys we will prompt you via a modal. Never enter',
    'keys directly into a notebook unless you explicitly intend to share',
    'them. If you would like to know more about authenticating',
    'with this API, see \'securityScheme.settings\' in the RAML file.'
  ].join(' ')
};

/**
 * Alter the context to include the RAML client generator.
 *
 * @param {Object}   context
 * @param {Function} next
 */
exports['sandbox:context'] = function (context, next) {
  // This is extremely janky, but is required for Safari 7.0 which seems to
  // be ignoring direct property assignments under certain conditions.
  Object.defineProperty(context, 'API', { value: API });
  return next();
};
