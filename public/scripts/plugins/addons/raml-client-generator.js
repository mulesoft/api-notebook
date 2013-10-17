/* global App */
var _               = App._;
var ramlParser      = require('raml-parser');
var clientGenerator = require('./lib/client-generator');
var fromPath        = require('../../lib/from-path');

// Special documentation parameter.
var DESCRIPTION_PROPERTY = '@description';

/**
 * Override the RAML parser read file functionality and replace with middleware.
 *
 * @param  {String} file
 * @return {String}
 */
ramlParser.readFile = function (file) {
  var error, status, data;

  App.middleware.trigger('ajax', {
    url:     file,
    async:   false,
    headers: {
      'Accept': 'application/raml+yaml, */*'
    }
  }, function (err, xhr) {
    data   = xhr.responseText;
    error  = err;
    status = xhr.status;
  });

  if (error) {
    throw error;
  }

  if (Math.floor(status / 100) !== 2) {
    throw new Error('Failed to load RAML document at "' + file + '"');
  }

  return data;
};

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
 * @param {String}   [url]
 * @param {Function} done
 */
API.createClient = function (name, url, done) {
  if (!_.isString(name)) {
    throw new Error('Provide a name for the generated client');
  }

  if (!_.isString(url)) {
    throw new Error('Provide a URL for the ' + name + ' RAML document');
  }

  App._executeContext.timeout(Infinity);
  done = done || App._executeContext.async();

  // Pass our url to the RAML parser for processing and transform the promise
  // back into a callback format.
  ramlParser.loadFile(url).then(function (data) {
    var client;

    try {
      client = clientGenerator(data);
      fromPath(App._executeWindow, name.split('.'), client);
    } catch (e) {
      return done(e);
    }

    return done(null, client);
  }, function (err) {
    return done(err);
  });
};

API.createClient[DESCRIPTION_PROPERTY] = {
  '!type': 'fn(alias: string, url: string, cb?: fn(error, client))',
  '!doc': [
    'Generate an API client from a RAML document and alias it on the window.'
  ].join(' ')
};

/**
 * Alter the context to include the RAML client generator.
 *
 * @param {Object}   data
 * @param {Function} next
 */
var contextPlugin = function (context, next) {
  context.API = API;

  return next();
};

/**
 * A { key: function } map of all middleware used in the plugin.
 *
 * @type {Object}
 */
var plugins = {
  'sandbox:context': contextPlugin
};

/**
 * Attach the middleware to the application.
 *
 * @param {Object} middleware
 */
exports.attach = function (middleware) {
  middleware.use(plugins);
};

/**
 * Detaches the middleware from the application. Useful during tests.
 *
 * @param {Object} middleware
 */
exports.detach = function (middleware) {
  middleware.disuse(plugins);
};
