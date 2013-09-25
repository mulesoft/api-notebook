/* global App */
var _               = App._;
var ramlParser      = require('raml-parser');
var clientGenerator = require('./lib/client-generator');

/**
 * Parse a path string to a reference on the object. Supports passing an
 * optional setter.
 *
 * @param  {Object} object
 * @param  {String} path
 * @param  {*}      [setter]
 * @return {*}
 */
var fromPath = function (object, path, setter) {
  var isSetter = false;
  var nodes    = path.split('.');

  // Check that we have passed a third argument as the setter.
  if (arguments.length > 2) {
    isSetter = true;
  }

  var reference = _.reduce(nodes, function (object, prop, index) {
    if (isSetter) {
      // If we are at the last property, set the value.
      if (index === nodes.length - 1) {
        return object[prop] = setter;
      }

      // Ensure the object is available.
      if (!(prop in object)) {
        object[prop] = {};
      }
    }

    return object[prop];
  }, object);

  return reference;
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
      fromPath(App._executeWindow, name, client);
    } catch (e) {
      return done(e);
    }

    return done(null, client);
  }, function (err) {
    return done(err);
  });
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
