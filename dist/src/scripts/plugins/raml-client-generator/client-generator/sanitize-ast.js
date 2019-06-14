/* global App */
var _ = App.Library._;

/**
 * Sanitize the secured by into an object.
 *
 * @param  {Array}  secured
 * @return {Object}
 */
var sanitizeSecuredBy = function (secured) {
  if (!Array.isArray(secured)) {
    return null;
  }

  var securedBy = {};

  // Since `securedBy` can either be an array of strings or array of objects
  // with only a single key, we merge it down to an object.
  _.each(secured, function (value) {
    if (value == null) {
      return; // Ignore `null` array values, shouldn't be useful to me.
    }

    if (_.isString(value)) {
      return securedBy[value] = true;
    }

    return _.extend(securedBy, value);
  });

  return securedBy;
};

/**
 * Sanitize the AST from the RAML parser into something easier to work with.
 *
 * @param  {Object} ast
 * @return {Object}
 */
module.exports = function (ast) {
  // Create the base sanitized ast with only the properties we want.
  var sanitizedAst = _.pick(ast, [
    'title',
    'version',
    'baseUri',
    'baseUriParameters'
  ]);

  // Merge an array of objects into a single object using `_.extend` and
  // `apply` (since `_.extend` accepts unlimited number of arguments).
  if (ast.securitySchemes) {
    sanitizedAst.securitySchemes = _.extend.apply(_, ast.securitySchemes);
  }

  // Sanitize secured by which is a bit more complicated than extending.
  if (ast.securedBy) {
    sanitizedAst.securedBy = sanitizeSecuredBy(ast.securedBy);
  }

  // Recurse through the resources and move URIs to be the key names.
  sanitizedAst.resources = (function flattenResources (resources) {
    var map = {};

    // Resources are provided as an array, we'll move them to be an object.
    _.each(resources, function (resource) {
      var sanitizedResource = {};

      // Methods are implemented as arrays of objects too, but not recursively.
      // TODO: If the endpoint is the final route and has no methods, implement
      // backtracking and remove access to it from the AST.
      if (resource.methods) {
        sanitizedResource.methods = _.object(
          _.pluck(resource.methods, 'method'),
          _.map(resource.methods, function (method) {
            // Create the sanitized method by including the properties we want.
            var sanitizedMethod = _.pick(method, [
              'method',
              'body',
              'headers',
              'description',
              'queryParameters',
              'queryString'
            ]);

            // Sanitize the `securedBy` method.
            if (method.securedBy) {
              sanitizedMethod.securedBy = sanitizeSecuredBy(method.securedBy);
            }

            return sanitizedMethod;
          })
        );
      }

      if (resource.resources) {
        sanitizedResource.resources = flattenResources(resource.resources);
      }

      (function attachResource (map, segments) {
        var segment = segments.shift();
        var part    = map[segment] = map[segment] || {};

        // Currently on the last url segment, embed the full resource.
        if (!segments.length) {
          part = map[segment] = sanitizedResource;
        }

        // Pull any possible tags out of the relative uri part.
        var tags = _.map(segment.match(/\{([^\}]+)\}/g), function (tag) {
          return tag.slice(1, -1);
        });

        // Add only the used tags to the current resource segment.
        if (tags.length) {
          part.uriParameters = _.pick(resource.uriParameters, tags);
        }

        // If we have more segment parts left, recursively embed resources.
        if (segments.length) {
          part.resources = part.resources || {};

          return attachResource(part.resources, segments);
        }
      })(map, resource.relativeUri.substr(1).split('/'));
    });

    return map;
  })(ast.resources);

  return sanitizedAst;
};
