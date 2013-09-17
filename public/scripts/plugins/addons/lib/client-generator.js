/* global App */
var _    = App._;
var url  = App.Library.url;
var path = App.Library.path;

var RETURN_PROPERTY = '@return';

// Catch commonly used regular expressions
var TEMPLATE_REGEX = /\{(\w+)\}/g;

/**
 * Simple "template" function for working with the uri param variables.
 *
 * @param  {String} template
 * @param  {Object} context
 * @return {String}
 */
var template = function (template, context) {
  return template.replace(TEMPLATE_REGEX, function (_, $0) {
    return context[$0];
  });
};

/**
 * Sanitize the AST from the RAML parser into something easier to work with.
 *
 * @param  {Object} ast
 * @return {Object}
 */
var sanitizeAST = function (ast) {
  // Merge the redundancy of arrays the easy of one property each.
  ast.traits        = _.extend.apply(_, ast.traits);
  ast.resourceTypes = _.extend.apply(_, ast.resourceTypes);
  // Recurse through the resources and move the URIs to the key names.
  ast.resources = (function flattenResources (resources) {
    var map = {};
    // Resources are provided as an object, we'll move them to be key based.
    _.each(resources, function (resource) {
      // Methods are implemented as arrays of objects too, but not recursively.
      if (resource.methods) {
        resource.methods = _.object(
          _.pluck(resource.methods, 'method'), resource.methods
        );
      }
      // Recursively resolves resources.
      if (resource.resources) {
        resource.resources = flattenResources(resource.resources);
      }
      // Remove the prefixed `/` from the relativeUri.
      map[resource.relativeUri.substr(1)] = resource;
    });
    // Returns the updated resources
    return map;
  })(ast.resources);
  // Returns the AST object, everything has been modified in place.
  return ast;
};

/**
 * List of all plain HTTP methods in the format from the AST.
 *
 * @type {Object}
 */
var httpMethods = _.chain(
    ['get', 'put', 'post', 'patch', 'delete']
  ).map(function (method) {
    return [method, {
      method: method
    }];
  }).object().value();

/**
 * Returns a function that can be used to make ajax requests.
 *
 * @param  {Object}   uri
 * @return {Function}
 */
var httpRequest = function (uri, method) {
  // Switch behaviour based on the method data.
  return function () {
    var done;

    // We know this code works, so bump up the execution timeout. This needs to
    // be done before we call `async` so that it will use this value.
    App._executeContext.timeout = Infinity;

    if (arguments.length > 1) {
      done = arguments[1];
    } else {
      done = App._executeContext.async();
    }

    var options = {
      url:  uri.href,
      type: method.method
    };

    // Trigger ajax middleware resolution so other middleware can hook onto
    // these requests and augment.
    App.middleware.trigger('ajax', options, done);

    // Return the XHR request.
    return options.xhr;
  };
};

/**
 * Generate the client object from a sanitized AST object.
 *
 * @param  {Object} ast
 * @return {Object}
 */
var generateClient = function (ast) {
  var uri = url.parse(ast.baseUri, true);

  /**
   * Attaches executable XHR methods to the context object.
   *
   * @param  {Array}  nodes
   * @param  {Object} context
   * @param  {Object} methods
   * @return {Object}
   */
  var attachMethods = function (nodes, context, methods) {
    // Use the `path` module to join the url parts together.
    var route = path.join.apply(null, [uri.path].concat(nodes));

    // Iterate over all the possible methods and attach.
    _.each(methods, function (method, verb) {
      context[verb] = httpRequest(_.extend({}, uri, {
        href:     url.resolve(uri.href, route),
        path:     route + uri.search,
        pathname: route
      }), method);
    });

    return context;
  };

  /**
   * The root client implementation is simply a function. This allows us to
   * enter a custom path that may not be supported by the DSL and run any method
   * regardless of whether it was defined in the spec.
   *
   * @param  {String} path
   * @param  {Object} context
   * @return {Object}
   */
  var client = function (path, context) {
    return attachMethods(template(path, context || {}), {}, httpMethods);
  };

  // Enable the `@return` property used by the completion plugin.
  client[RETURN_PROPERTY] = attachMethods('', {}, httpMethods);

  /**
   * Recurses through a resource object in the RAML AST, generating a dynamic
   * DSL that only allows methods that were defined in the RAML spec.
   *
   * @param  {Array}  nodes     An array of path nodes that can be joined.
   * @param  {Object} context   Where to attach the resource routes.
   * @param  {Object} resources An object of resource routes.
   * @return {Object}           Returns the passed in context object.
   */
  (function attachResources (nodes, context, resources) {
    // Iterate over all resource keys
    _.each(resources, function (resource, route) {
      var routeName  = route;
      var resources  = resource.resources;
      var routeNodes = nodes.concat(route);
      var allTemplates;

      // The route contains any number of templates and text.
      if (allTemplates = route.match(TEMPLATE_REGEX)) {
        var group      = allTemplates.join('');
        var startIndex = route.length - group.length;
        // The route must end with the template tags and have no intermediate
        // text between template tags.
        if (route.indexOf(group) === startIndex) {
          var startText = route.substr(0, startIndex);
          // The route is only a template tag with no static text, use the
          // template tag text.
          if (startIndex === 0) {
            routeName = allTemplates[0].slice(1, -1);
          } else {
            routeName = startText;
          }

          context[routeName] = function () {
            var args = _.first(arguments, allTemplates.length);

            // Check the taken arguments length matches the expected number.
            if (args.length !== allTemplates.length) {
              throw new Error(
                'Insufficient parameters given for "' + route + '". ' +
                'Expected ' + allTemplates.length + ', but got ' + args.length
              );
            }

            var newContext = {};
            var routeNodes = nodes.concat(startText + args.join(''));
            attachMethods(routeNodes, newContext, resource.methods);
            return attachResources(routeNodes, newContext, resources);
          };

          var returnPropContext = {};
          attachMethods(routeNodes, returnPropContext, resource.methods);
          attachResources(routeNodes, returnPropContext, resources);
          return context[routeName][RETURN_PROPERTY] = returnPropContext;
        } else {
          return false;
        }
      }

      // The route is only static text, we can easily add the next route.
      var newContext = context[routeName] || (context[routeName] = {});
      attachMethods(routeNodes, newContext, resource.methods);
      return attachResources(routeNodes, newContext, resources);
    });

    // Chainability
    return context;
  })([], client, ast.resources);

  // Returns the root of the DST.
  return client;
};

/**
 * Exports the client generator, which accepts the AST of a RAML document.
 *
 * @return {Object} Dynamic object for constructing API requests from the AST.
 */
module.exports = function (ast) {
  return generateClient(sanitizeAST(ast));
};