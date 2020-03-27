/* global App */
var _ = App.Library._;

/**
 * Match raml uri parameters in a uri.
 *
 * @type {RegExp}
 */
var URI_PARAM_REGEXP = /{[^}]+}/g;

/**
 * Simple "template" function for working with the uri param variables.
 *
 * @param  {String}         template
 * @param  {(Object|Array)} context
 * @return {String}
 */
exports = module.exports = function (string, context) {
  context = context || {};

  // No uri string has been specified.
  if (string == null) {
    return null;
  }

  // If the context is an array, we need to transform the replacements into
  // index based positions for the uri template parser.
  if (_.isArray(context)) {
    var index = 0;

    return string.replace(URI_PARAM_REGEXP, function () {
      return encodeURIComponent(context[index++] || '');
    });
  }

  return string.replace(URI_PARAM_REGEXP, function (match) {
    return encodeURIComponent(context[match.slice(1, -1)] || '');
  });
};

/**
 * Export the replacement regexp.
 */
exports.REGEXP = URI_PARAM_REGEXP;
