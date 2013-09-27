/* global App */
var _      = App._;
var qs     = App.Library.querystring;
var trim   = require('trim');
var escape = require('escape-regexp');
var parser = require('uri-template');

var toString         = Object.prototype.toString;
var HTTP_METHODS     = ['get', 'head', 'put', 'post', 'patch', 'delete'];
var RETURN_PROPERTY  = '@return';
var RESERVED_METHODS = _.object(HTTP_METHODS.concat('headers', 'query'), true);

/**
 * Runs validation logic against uri parameters from the RAML spec. Throws an
 * error with the validation issue when the validation fails.
 *
 * @param  {*}      value
 * @param  {Object} param
 * @return {Boolean}
 */
var validateParam = function (value, param) {
  var stringify = JSON.stringify;

  // Do an initial check for the required value and fail early.
  if (param.required === true && value == null) {
    throw new ReferenceError(param.displayName + ' is not defined');
  }

  // If it has a value, we can proceed with the rest of the checks.
  if (value != null) {
    if (param.type === 'string') {
      // Check the passed in value is a number.
      if (!_.isString(value)) {
        throw new TypeError('Expected a string, but got ' + stringify(value));
      }

      // Validate against the enum list.
      if (_.isArray(param.enum) && !_.contains(param.enum, value)) {
        throw new Error([
          'Expected a value of', param.enum.join(', ') + ',',
          'but got', stringify(value)
        ].join(' '));
      }

      // Validate the string length against the minimum required length.
      var minLength = param.minLength;
      if (minLength === +minLength && value.length < minLength) {
        throw new Error([
          'Expected a minimum length of', minLength + ',',
          'but got a length of', value.length
        ].join(' '));
      }

      // Validate the string length against the maximum allowed length.
      var maxLength = param.maxLength;
      if (maxLength === +maxLength && value.length > maxLength) {
        throw new Error([
          'Expected a maximum length of', maxLength + ',',
          'but got a length of', value.length
        ].join(' '));
      }

      // Validate the string against the pattern.
      var pattern = param.pattern;
      if (_.isString(pattern) && !(new RegExp(pattern).test(value))) {
        throw new Error('Expected the value to match ' + pattern);
      }
    } else if (param.type === 'integer' || param.type === 'number') {
      if (param.type === 'number') {
        // Validates that the value is a number and not `NaN`.
        if (value !== +value) {
          throw new TypeError('Expected a number, but got' + stringify(value));
        }
      } else {
        // Validates that the value is an integer and not `NaN`.
        if (value !== parseInt(value, 10)) {
          throw new TypeError(
            'Expected an integer, but got ' + stringify(value)
          );
        }
      }

      if (param.minimum === +param.minimum && value < param.minimum) {
        throw new Error('Expected a value larger than ' + param.minimum +
          ', but got ' + stringify(value));
      }

      if (param.maximum === +param.maximum && value > param.maximum) {
        throw new Error('Expected a value smaller than ' + param.minimum +
          ', but got ' + stringify(value));
      }
    } else if (param.type === 'date') {
      // Validate that the value is a date.
      if (!_.isDate(value)) {
        throw new TypeError('Expected a date, but got ' + stringify(value));
      }
    } else if (param.type === 'boolean') {
      // Validate the value is a boolean.
      if (!_.isBoolean(value)) {
        throw new TypeError('Expected a boolean, but got ' + stringify(value));
      }
    }
  }

  return true;
};

/**
 * Pass a whole query params object through the param validation function.
 *
 * @param  {Object}  object
 * @param  {Object}  params
 * @return {Boolean}
 */
var validateParams = function (object, params) {
  object = object || {};

  _.each(params, function (validate, param) {
    return validateParam(object[param], validate);
  });

  return true;
};

/**
 * Simple "template" function for working with the uri param variables.
 *
 * @param  {String}       template
 * @param  {Object}       params
 * @param  {Object|Array} context
 * @return {String}
 */
var template = function (string, params, context) {
  // If the context is an array, we need to transform the replacements into
  // index based positions for the uri template parser.
  if (_.isArray(context)) {
    var index = -1;

    // Transform the params into a regular expression for matching.
    var paramRegex = new RegExp('{(' + _.map(_.keys(params), function (param) {
      return escape(param);
    }).join('|') + ')}', 'g');

    string = string.replace(paramRegex, function (match, param) {
      validateParam(context[++index], params[param]);
      return '{' + index + '}';
    });
  } else {
    validateParams(context, params);
  }

  return parser.parse(string).expand(context);
};

/**
 * Sanitize the AST from the RAML parser into something easier to work with.
 *
 * @param  {Object} ast
 * @return {Object}
 */
var sanitizeAST = function (ast) {
  // Merge an array of objects into a single object using `_.extend` and
  // `apply` (since `_.extend` accepts unlimited number of arguments).
  ast.traits          = _.extend.apply(_, ast.traits);
  ast.resourceTypes   = _.extend.apply(_, ast.resourceTypes);
  ast.securitySchemes = _.extend.apply(_, ast.securitySchemes);

  // Recurse through the resources and move URIs to be the key names.
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

      if (resource.resources) {
        resource.resources = flattenResources(resource.resources);
      }

      // Remove the prefixed `/` from the relativeUri.
      map[resource.relativeUri.substr(1)] = resource;
    });

    return map;
  })(ast.resources);

  // Parse the root url and inject variables.
  ast.baseUri = template(ast.baseUri, ast.baseUriParameters, ast);

  return ast;
};

/**
 * List of all plain HTTP methods in the format from the AST.
 *
 * @type {Object}
 */
var httpMethods = _.chain(HTTP_METHODS).map(function (method) {
    return [method, {
      method: method
    }];
  }).object().value();

/**
 * Parse an XHR request for response headers and return as an object. Pass an
 * additional flag to filter any potential duplicate headers (E.g. different
 * cases).
 *
 * @param  {Object}  xhr
 * @param  {Boolean} [filterDuplicates]
 * @return {Object}
 */
var getReponseHeaders = function (xhr, filterDuplicates) {
  var responseHeaders = {};

  _.each(xhr.getAllResponseHeaders().split('\n'), function (header) {
    header = header.split(':');

    // Make sure we have both parts of the header.
    if (header.length === 2) {
      var name  = filterDuplicates ? header[0].toLowerCase() : header[0];
      var value = trim(header[1]);
      responseHeaders[name] = value;
    }
  });

  return responseHeaders;
};

/**
 * Check that the XHR request has a response body.
 *
 * @param  {Object}  xhr
 * @return {Boolean}
 */
var hasBody = function (xhr) {
  return !!xhr.responseText.length;
};

/**
 * Return the xhr response mime type.
 *
 * @param  {String} contentType
 * @return {String}
 */
var getMime = function (contentType) {
  return (contentType || '').split(';')[0];
};

/**
 * Check if the mime type matches JSON.
 *
 * @param  {String}  mime
 * @return {Boolean}
 */
var isJSON = function (mime) {
  // https://github.com/senchalabs/connect/blob/
  // 296398a001d97fd0e8dafa622fc75c874a06c3d6/lib/middleware/json.js#L78
  return (/^application\/([\w!#\$%&\*`\-\.\^~]*\+)?json$/i).test(mime);
};

/**
 * Check if the mime type matches url encoding.
 *
 * @param  {String}  mime
 * @return {Boolean}
 */
var isUrlEncoded = function (mime) {
  return mime === 'application/x-www-form-urlencoded';
};

/**
 * Check if the mime type matches form data.
 *
 * @param  {String}  mime
 * @return {Boolean}
 */
var isFormData = function (mime) {
  return mime === 'multipart/form-data';
};

/**
 * Gets a header from the header object.
 *
 * @param  {Object}  headers
 * @param  {String}  header
 * @return {Boolean}
 */
var getHeader = function (headers, header) {
  header = header.toLowerCase();

  return _.find(headers, function (value, name) {
    return name.toLowerCase() === header;
  });
};

/**
 * Sanitize the XHR request into the desired format.
 *
 * @param  {XMLHttpRequest} xhr
 * @return {Object}
 */
var sanitizeXHR = function (xhr) {
  if (!xhr) { return xhr; }

  var mime    = getMime(xhr.getResponseHeader('Content-Type'));
  var body    = xhr.responseText;
  var headers = getReponseHeaders(xhr);

  if (hasBody(xhr)) {
    if (isJSON(mime)) {
      body = JSON.parse(body);
    } else if (isUrlEncoded(mime)) {
      body = qs.parse(body);
    }
  }

  return {
    body:      body,
    status:    xhr.status,
    headers:   headers,
    getHeader: _.bind(getHeader, null, getReponseHeaders(xhr, true))
  };
};

/**
 * Returns a function that can be used to make ajax requests.
 *
 * @param  {String}   url
 * @return {Function}
 */
var httpRequest = function (nodes, method) {
  return function (data, done) {
    var async   = !!done;
    var query   = nodes.query   || {};
    var headers = nodes.headers || {};
    var mime    = getMime(getHeader(headers, 'Content-Type'));
    var fullUrl = nodes.baseUri + '/' + nodes.join('/');

    // No need to pass data through with `GET` or `HEAD` requests.
    if (method.method === 'get' || method.method === 'head') {
      // If we passed in an argument, it should be set as the query string.
      if (data != null) {
        query = data;
      }

      // Unset the data object.
      data = null;
    }

    // Make sure the passed in `query` is an object for validation.
    if (query != null && !_.isObject(query)) {
      query = qs.parse(query);
    }

    // Pass the query parameters through validation and append to the url.
    if (validateParams(query, method.queryParameters)) {
      query = qs.stringify(query);

      fullUrl += query ? '?' + query : '';
    }

    // Set the correct Content-Type header, if none exists. Kind of random if
    // more than one exists - in that case I would suggest setting it yourself.
    if (!mime && typeof method.body === 'object') {
      headers['Content-Type'] = mime = _.keys(method.body).pop();
    }

    var canSerialize = ['[object Object]', '[object Array]'];

    // If we were passed in data, attempt to sanitize it to the correct type.
    if (_.contains(canSerialize, toString.call(data))) {
      if (isJSON(mime)) {
        data = JSON.stringify(data);
      } else if (isUrlEncoded(mime)) {
        data = qs.stringify(data);
      } else if (isFormData(mime)) {
        // Attempt to use the form data object - available in newer browsers.
        var formData = new FormData();
        _.each(data, function (value, key) {
          formData.append(key, value);
        });

        // Set the data to the form data instance.
        data     = formData;
        formData = null;
      }
    }

    var options = {
      url:     fullUrl,
      data:    data,
      async:   async,
      method:  method.method,
      headers: headers
    };

    if (async && !_.isFunction(done)) {
      done = App._executeContext.async();
    }

    // Trigger the ajax middleware so plugins can hook onto the requests. If the
    // function is async we need to register a callback for the middleware.
    App.middleware.trigger('ajax', options, async && function (err, xhr) {
      return done(err, sanitizeXHR(xhr));
    });

    // If the request was synchronous, return the sanitized XHR response data.
    if (!async) {
      return sanitizeXHR(options.xhr);
    }
  };
};

/**
 * Attach the query string helper.
 *
 * @param  {Array}  nodes
 * @param  {Object} context
 * @param  {Object} methods
 * @return {Object}
 */
var attachQuery = function (nodes, context, methods) {
  if ('query' in nodes) {
    return context;
  }

  var routeNodes = _.extend([], nodes, {
    query: null
  });

  context.query = function (query) {
    routeNodes.query = query;
    return attachMethods(routeNodes, {}, methods);
  };

  context.query[RETURN_PROPERTY] = attachMethods(routeNodes, {}, methods);

  return context;
};

/**
 * Attach the headers helper.
 *
 * @param  {Array}  nodes
 * @param  {Object} context
 * @param  {Object} methods
 * @return {Object}
 */
var attachHeaders = function (nodes, context, methods) {
  if ('headers' in nodes) {
    return context;
  }

  var routeNodes = _.extend([], nodes, {
    headers: null
  });

  context.headers = function (headers) {
    if (typeof headers !== 'object') {
      throw new Error('Ajax headers must be provided as an object');
    }

    routeNodes.headers = headers;
    return attachMethods(routeNodes, {}, methods);
  };

  context.headers[RETURN_PROPERTY] = attachMethods(routeNodes, {}, methods);

  return context;
};

/**
 * Attaches executable XHR methods to the context object.
 *
 * @param  {Array}  nodes
 * @param  {Object} context
 * @param  {Object} methods
 * @return {Object}
 */

// Disable JSHint throwing an error about `attachMethods` being used before it
// was defined, since it is being used in `attachHeaders` and `attachQuery`.

/* jshint -W003 */
var attachMethods = function (nodes, context, methods) {
  var newContext, routeNodes;

  attachQuery(nodes, context, methods);
  attachHeaders(nodes, context, methods);

  // Iterate over all the possible methods and attach.
  _.each(methods, function (method, verb) {
    context[verb] = httpRequest(nodes, method);
  });

  return context;
};
/* jshint +W003 */

/**
 * Recurses through a resource object in the RAML AST, generating a dynamic
 * DSL that only allows methods that were defined in the RAML spec.
 *
 * @param  {Array}  nodes     An array of path nodes that can be joined.
 * @param  {Object} context   Where to attach the resource routes.
 * @param  {Object} resources An object of resource routes.
 * @return {Object}           Returns the passed in context object.
 */
var attachResources = function attachResources (nodes, context, resources) {
  _.each(resources, function (resource, route) {
    var routeName = route;
    var resources = resource.resources;
    // Use `extend` to clone the nodes since we attach meta data directly to
    // the nodes.
    var routeNodes   = _.extend([], nodes);
    var templateTags = resource.uriParameters && _.keys(resource.uriParameters);

    routeNodes.push(route);

    if (templateTags && templateTags.length) {
      // The route must end with template tags and have no intermediate text
      // between template tags.
      if (/^\w*(?:\{[^\{\}]+\})+$/.test(route)) {
        var templateCount = templateTags.length;

        // If the route is only a template tag with no static text, use the
        // template tag text as the method name.
        if (templateCount === 1 && '{' + templateTags[0] + '}' === route) {
          routeName = templateTags.pop();
        } else {
          routeName = route.substr(0, route.indexOf('{'));
        }

        // Don't add reserved methods to the context. This is done to avoid
        // potentially confusing use cases. *Was it `get` to make the request
        // or to set the path?*
        if (_.has(RESERVED_METHODS, routeName)) {
          return false;
        }

        // The route is dynamic, so we set the route name to be a function
        // which accepts the template arguments and updates the path fragment.
        // We'll extend any route already at the same namespace so we can do
        // things like use both `/{route}` and `/route`, if needed.
        context[routeName] = _.extend(function () {
          if (arguments.length < templateCount) {
            throw new Error([
              'Insufficient parameters, expected at least',
              templateCount, 'arguments'
            ].join(' '));
          }

          // Change the last path fragment to the proper template text.
          routeNodes[routeNodes.length - 1] = template(
            route, resource.uriParameters, _.toArray(arguments)
          );

          var newContext = {};
          attachMethods(routeNodes, newContext, resource.methods);
          return attachResources(routeNodes, newContext, resources);
        }, context[routeName]);

        var returnPropContext = {};
        attachMethods(routeNodes, returnPropContext, resource.methods);
        attachResources(routeNodes, returnPropContext, resources);
        return context[routeName][RETURN_PROPERTY] = returnPropContext;
      } else {
        return false;
      }
    }

    // If the route is only static text we can easily add the next route.
    var newContext = context[routeName] || (context[routeName] = {});
    attachMethods(routeNodes, newContext, resource.methods);
    return attachResources(routeNodes, newContext, resources);
  });

  return context;
};

/**
 * Generate the client object from a sanitized AST object.
 *
 * @param  {Object} ast Passed through `sanitizeAST`
 * @return {Object}
 */
var generateClient = function (ast) {
  var nodes = _.extend([], {
    baseUri: ast.baseUri.replace(/\/+$/, '')
  });

  /**
   * The root client implementation is simply a function. This allows us to
   * enter a custom path that may not be supported by the DSL and run any
   * method regardless of whether it was defined in the spec.
   *
   * @param  {String} path
   * @param  {Object} context
   * @return {Object}
   */
  var client = function (path, context) {
    var route = template(
      path, {}, context || {}
    ).replace(/^\/+/, '').split('/');

    return attachMethods(_.extend([], nodes, route), {}, httpMethods);
  };

  // Enable the `@return` property used by the completion plugin.
  client[RETURN_PROPERTY] = attachMethods(nodes, {}, httpMethods);

  // Attach all the resources to the returned client function.
  attachResources(nodes, client, ast.resources);

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
