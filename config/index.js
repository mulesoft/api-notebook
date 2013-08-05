/**
 * Simple configuration merging module.
 * Takes default settings and merges them with
 */
module.exports = (function() {
  var _ = require('lodash');
  var config = require('./config.default');
  var env = process.env.NODE_ENV || "development";
  var envConfig = './config.' + env;

  // Override defaults with environment specific configuration.
  _.merge(config, require(envConfig));

  return config;
}());