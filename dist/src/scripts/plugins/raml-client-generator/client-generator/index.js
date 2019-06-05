/* global App */
var _           = App.Library._;
var qs          = App.Library.qs;
var template    = require('./template');
var sanitizeAST = require('./sanitize-ast');

var CONFIG_PROPERTY = '!config';
var CLIENT_PROPERTY = '!client';

var JSON_REGEXP = /^application\/([\w!#\$%&\*`\-\.\^~]*\+)?json$/i;

var HTTP_METHODS         = ['get', 'head', 'put', 'post', 'patch', 'delete'];
var RETURN_PROPERTY      = '!return';
var DESCRIPTION_PROPERTY = '!description';
var CONFIG_OPTIONS       = [
  'body',
  'proxy',
  'uriParameters',
  'baseUri',
  'baseUriParameters',
  'headers',
  'query',
  'beforeSend'
];
var OVERRIDABLE_CONFIG_OPTIONS = _.object(
  ['body', 'proxy', 'baseUri', 'beforeSend'], true
);

/**
 * Static description of the media type extension function.
 *
 * @type {Object}
 */
var EXTENSION_DESCRIPTION = {
  '!type': 'fn(extension)',
  '!args': [{
    '!type': 'string',
    '!doc':  'Set the file extension with relevant `Accept` header.'
  }],
  '!doc': [
    'Set the path extension and corresponding accept header.'
  ].join(' ')
};

/**
 * Static description of the client object.
 *
 * @type {Object}
 */
var CLIENT_DESCRIPTION = {
  '!type': 'fn(url, data?)',
  '!args': [{
    '!type': 'string',
    '!doc':  'Provide a url relative to the base uri.'
  }, {
    '!type': 'object',
    '!doc':  'Provide a data object to replace template tags in the `url`.'
  }],
  '!doc': [
    'Make an API request to a custom URL.'
  ].join(' ')
};

/**
 * Map the supported auth types to the known triggers.
 *
 * @type {Object}
 */
var authMap = {
  'OAuth 1.0':            'oauth1',
  'OAuth 2.0':            'oauth2',
  'Basic Authentication': 'basicAuth'
};

/**
 * Transform a data object into a form data instance.
 *
 * @param  {Object}   data
 * @return {FormData}
 */
var toFormData = function (data) {
  var form = new FormData();

  // Iterate over every piece of data and append to the form data object.
  _.each(data, function (value, key) {
    form.append(key, value);
  });

  return form;
};

/**
 * Transform a data object into a String.
 *
 * @param  {Object}   data
 * @return {String}
 */
var toString = function (data) {
  return String(data);
};

/**
 * Map mime types to their parsers.
 *
 * @type {Array}
 */
var parse = [
  [JSON_REGEXP, JSON.parse],
  ['application/x-www-form-urlencoded', qs.parse]
];

/**
 * Map mime types to their serializers.
 *
 * @type {Array}
 */
var serialize = [
  [JSON_REGEXP, JSON.stringify],
  ['application/x-www-form-urlencoded', qs.stringify],
  ['text/html', toString],
  ['multipart/form-data', toFormData]
];

/**
 * Iterate over an array of match and result values, and return the
 * first matching value.
 *
 * @param  {Array}    array
 * @param  {String}   test
 * @return {Function}
 */
var getMatch = function (array, test) {
  var match = _.find(array, function (value) {
    var check = value[0];

    if (_.isRegExp(check)) {
      return check.test(test);
    }

    return check === test;
  });

  return match && match[1];
};

/**
 * Sort mimes by preference.
 *
 * @param  {String} mime
 * @return {Number}
 */
var mimePreference = function (mime) {
  return getMatch([
    [JSON_REGEXP, 3],
    ['application/x-www-form-urlencoded', 2],
    ['multipart/form-data', 1]
  ], mime) || 0;
};

/**
 * Turn a string into inline code.
 *
 * @param  {String} str
 * @return {String}
 */
var codifyMarkdown = function (str) {
  return '`' + str + '`';
};

/**
 * Convert a raml body object to a markdown documentation string.
 *
 * @param  {Object} body
 * @return {String}
 */
var ramlBodyToMarkdown = function (body) {
  var mimes         = _.keys(body).sort(mimePreference);
  var documentation = [];

  // If multiple mime types are supported, add a default mime type usage note.
  if (mimes.length > 1) {
    documentation.push(
      'The body for this resource supports multiple content types. By ' +
      'default, ' + codifyMarkdown(mimes[0]) + ' will be used. However, you ' +
      'can easily specify another `Content-Type` to be used.'
    );
  }

  // Iterate over each mime type and append documentation.
  _.each(mimes, function (mime) {
    var contentType = body[mime];

    // Avoid building documentation if it's not an object.
    if (!_.isObject(contentType)) {
      return;
    }

    // If there are multiple available mime types, we need to prefix each
    // definition with some text about the current mime type.
    if (mimes.length > 1) {
      documentation.push(
        'When the content type is ' + codifyMarkdown(mime) + ':'
      );
    }

    // Append the available form parameters to the markdown content.
    if (contentType.formParameters) {
      // Iterate over each form parameter and generate basic documentation.
      _.each(contentType.formParameters, function (param, key) {
        documentation.push(
          '* **' + key + (param.required ? '' : '?') + ':** ' +
          '*' + param.type + '* ' + param.description
        );
      });
    }

    // Push the example onto the description for reference.
    if (contentType.example || contentType.examples) {
      (function () {
        var example = contentType.example || userfriendlifyExamples(contentType.examples);
        if (typeof example !== 'string') {
          example = JSON.stringify(example, null, 2);
        } else {
          try {
            example = JSON.stringify(JSON.parse(example), null, 2);
          } catch (e) {}
        }

        documentation.push(
          '**Example(s):**',
          '```\n' + example + '\n```'
        );
      })();
    }

    // Push the schema onto the description for reference.
    if (contentType.schema) {
      documentation.push(
        '**Schema:**',
        '**' + contentType.schema + '**',
        '```\n' + contentType.schemaContent + '\n```'
      );
    }
  });

  return documentation.join('\n\n');
};

var userfriendlifyExamples = function (examples) {
  var newExamples = {};

  examples.forEach(function (example, index) {
    newExamples[example.name || ('Example #' + index + 1)] = example.value.content || example.value;
  });

  return newExamples;
};

/**
 * Check if a method is a query method (not a body as the argument).
 *
 * @param  {String}  method
 * @return {Boolean}
 */
var isQueryMethod = function (method) {
  return method === 'get' || method === 'head';
};

/**
 * Map of methods to their tooltip description objects.
 *
 * @type {Object}
 */
var METHOD_DESCRIPTION = _.object(_.map(HTTP_METHODS, function (method) {
  var body = isQueryMethod(method) ? 'query?' : 'body?';

  return [method, {
    '!type': 'fn(' + body + ', options?, async?)'
  }];
}));

/**
 * Convert a raml object into a documentation object.
 *
 * @param  {Object} object
 * @return {Object}
 */
var ramlToDocumentationFormat = function (object) {
  var documentation = {};

  // Iterate over each key and wipe out wipe a clean documentation object.
  _.each(object, function (object, key) {
    documentation[key] = {
      '!doc':      object.description,
      '!type':     object.type,
      '!required': object.required
    };
  });

  return documentation;
};

/**
 * Transform a RAML method object into a tooltip documentation object.
 *
 * @param  {Array}  nodes
 * @param  {Object} method
 * @return {Object}
 */
var toMethodDescription = function (nodes, method) {
  var isQuery       = isQueryMethod(method.method);
  var configOptions = { '!type': 'object' };
  var bodyOptions   = { '!type': 'object' };

  var callbackOptions = {
    '!doc':  'Pass a function to make the request execute asynchonously.',
    '!type': 'fn(error, response)'
  };

  // Add documentation on the proxy.
  configOptions.proxy = {
    '!type': 'string|boolean',
    '!doc':  'Disable or set a custom proxy url for the current request.'
  };

  // Document the `beforeSend` ability.
  configOptions.beforeSend = {
    '!type': 'fn(xhr)',
    '!doc':  'Modify the `XMLHttpRequest` before it gets sent.'
  };

  // If the method is a query method (GET/HEAD), set the body as a config option
  // and vise versa.
  var queryNodes = method.queryString ? method.queryString.properties : method.queryParameters;
  var headers    = method.headers || {};

  // If the method is secured by passthrough, add parameters and headers from its security scheme
  if (method.securedBy && method.securedBy.passthrough) {
    var passthroughScheme = nodes.client.securitySchemes.passthrough.describedBy;

    // add pass through query parameters to current method query nodes
    queryNodes = _.extend(queryNodes, passthroughScheme.queryParameters);

    // add pass through headers to current method headers
    headers = _.extend(headers, passthroughScheme.headers);
  }

  // Add documentation on header parameters.
  configOptions.headers = _.extend({
    '!type': 'object'
  }, ramlToDocumentationFormat(headers));


  if (isQuery) {
    _.extend(bodyOptions, ramlToDocumentationFormat(queryNodes));

    configOptions.body = {
      '!type': 'object',
      '!doc':  ramlBodyToMarkdown(method.body)
    };
  } else {
    bodyOptions = {
      '!type': 'object|string',
      '!doc':  ramlBodyToMarkdown(method.body)
    };

    configOptions.query = _.extend({
      '!type': 'object'
    }, ramlToDocumentationFormat(queryNodes));
  }

  // If the current node has baseUriParameters, show it in the documentation.
  if (nodes.client.baseUriParameters) {
    configOptions.baseUriParameters = _.extend({
      '!type': 'object'
    }, ramlToDocumentationFormat(nodes.client.baseUriParameters));
  }

  return _.extend({
    '!doc':  method.description,
    '!args': [bodyOptions, configOptions, callbackOptions]
  }, METHOD_DESCRIPTION[method.method]);
};

/**
 * List of all plain HTTP methods in the format from the AST.
 *
 * @type {Object}
 */
var allHttpMethods = _.chain(HTTP_METHODS).map(function (method) {
    return [method, {
      method: method
    }];
  }).object().value();

/**
 * Parse an XHR request for response headers and return as an object. Pass an
 * additional flag to filter any potential duplicate headers (E.g. different
 * cases).
 *
 * @param  {Object} xhr
 * @return {Object}
 */
var getAllReponseHeaders = function (xhr) {
  var responseHeaders = {};

  _.each(xhr.getAllResponseHeaders().split('\n'), function (header) {
    header = header.split(':');

    // Make sure we have both parts of the header.
    if (header.length > 1) {
      var name  = header.shift();
      responseHeaders[name.toLowerCase()] = header.join(':').trim();
    }
  });

  return responseHeaders;
};

/**
 * Return the xhr response mime type.
 *
 * @param  {String} contentType
 * @return {String}
 */
var getMime = function (contentType) {
  return contentType == null ? null : String(contentType).split(';')[0];
};

/**
 * Check if an object is a host object and avoid serializing.
 *
 * @param  {Object}  obj
 * @return {Boolean}
 */
var isHost = function (obj) {
  var str = Object.prototype.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object String]':
    case '[object Number]':
    case '[object Boolean]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
};

/**
 * Sanitize a specific configuration option.
 *
 * @type {Object}
 */
var sanitizeOption = {
  query: function (query) {
    if (_.isString(query)) {
      return qs.parse(query);
    }

    return query;
  }
};

/**
 * Gets a header from the header object.
 *
 * @param  {Object}  headers
 * @param  {String}  header
 * @return {String}
 */
var findHeader = function (headers, header) {
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
  var body    = xhr.responseText.trim();
  var headers = getAllReponseHeaders(xhr);

  // Automatically parse all response bodies. Only parse when we have response
  // body content. Errors that occur parsing will be propagated to the client.
  body = body ? (getMatch(parse, mime) || _.identity)(body) : undefined;

  return {
    body:    body,
    status:  xhr.status,
    headers: headers
  };
};

/**
 * Returns a function that can be used to make ajax requests.
 *
 * @param  {Object}   nodes
 * @param  {Object}   method
 * @return {Function}
 */
var httpRequest = function (nodes, method) {
  return function (body, config, done) {
    // Allow config to be omitted from arguments.
    if (_.isFunction(arguments[1])) {
      done   = arguments[1];
      config = null;
    }

    config = config || {};

    // Map configuration options and merge with the passed in object.
    config = _.object(CONFIG_OPTIONS, _.map(CONFIG_OPTIONS, function (option) {
      if (_.has(OVERRIDABLE_CONFIG_OPTIONS, option)) {
        return _.has(config, option) ? config[option] : nodes.config[option];
      }

      var nodeOption   = nodes.config[option];
      var configOption = config && config[option];
      var sanitize     = sanitizeOption[option] || _.identity;

      return _.extend({}, sanitize(nodeOption), sanitize(configOption));
    }));

    var async   = !!done;
    var request = 'ajax';
    var mime    = getMime(findHeader(config.headers, 'Content-Type'));
    var baseUri = template(config.baseUri, config.baseUriParameters);
    var fullUri = baseUri.replace(/\/+$/, '') + '/' + nodes.join('/');

    // If the request is async, set the relevant function callbacks.
    if (async) {
      App._executeContext.timeout(Infinity);

      if (!_.isFunction(done)) {
        done = App._executeContext.async();
      }
    } else {
      // Synchronous error and response handling.
      done = function (err, res) {
        if (err) {
          throw err;
        }

        return res;
      };
    }

    // GET and HEAD requests accept the query string as the first argument.
    if (isQueryMethod(method.method)) {
      _.extend(config.query, sanitizeOption.query(body));
      body = null;
    }

    // Set the config object body to the passed in body.
    if (body != null) {
      config.body = body;
    }

    // Append the query string if one is available.
    if (_.keys(config.query).length) {
      fullUri += '?' + qs.stringify(config.query);
    }

    // If we have no accept header set already, default to accepting
    // everything. This is required because Firefox sets the base accept
    // header to essentially be `html/xml`.
    if (!findHeader(config.headers, 'accept')) {
      config.headers.accept = '*/*';
    }

    // If we were passed in data, attempt to sanitize it to the correct type.
    if (!isHost(config.body)) {
      // Set the correct `Content-Type` header, if none exists. Kind of random
      // if more than one exists - I would suggest setting it yourself.
      if (mime == null) {
        // If we have a method body object, sort the method types by most
        // desirable and fallback to a random content type.
        if (typeof method.body === 'object') {
          mime = _.keys(method.body).sort(mimePreference).pop();
        }

        // Set the config to the updated mime type header. If none exists, use
        // `application/json` by default.
        config.headers['Content-Type'] = mime = mime || 'application/json';
      }

      // Automatically attempt to serialize the body.
      var serializer = getMatch(serialize, mime);

      if (!serializer) {
        return done(
          new TypeError('Can not serialize content type of "' + mime + '"')
        );
      }

      try {
        config.body = serializer(config.body);
      } catch (e) {
        return done(new TypeError('Could not serialize body: ' + e.message));
      }
    }

    var options = {
      url:        fullUri,
      data:       config.body,
      async:      async,
      proxy:      config.proxy,
      method:     method.method,
      headers:    config.headers,
      beforeSend: config.beforeSend
    };

    // Iterate through `securedBy` methods and accept the first one we are
    // already authenticated for.
    _.some(method.securedBy || nodes.client.securedBy, function (secured, key) {
      var scheme = nodes.client.securitySchemes[key];

      // Scheme is not documented in the RAML security schemes.
      if (!scheme) {
        return;
      }

      var authenticated = nodes.client.authentication[scheme.type];
      var authType      = authMap[scheme.type];

      if (authenticated) {
        options[authType] = authenticated;

        return (request = 'ajax:' + authType);
      }
    });

    // Awkward sync and async code mixing.
    var response, error;

    // Trigger the ajax middleware so plugins can hook onto the requests. If
    // the function is async we need to register a callback for the middleware.
    App.middleware.trigger(request, options, function (err, xhr) {
      error = err;

      if (!error) {
        try {
          response = sanitizeXHR(xhr);
        } catch (e) {
          error = new TypeError('Could not parse response: ' + e.message);
        }
      }

      return async && done(error, response);
    });

    // If the request was synchronous, return the sanitized XHR response data.
    if (!async) {
      return done(error, response);
    }
  };
};

/**
 * Attaches XHR request methods to the context object for each available method.
 *
 * @param  {Array}  nodes
 * @param  {Object} context
 * @param  {Object} methods
 * @return {Object}
 */
var attachMethods = function (nodes, context, methods) {
  // Attach the available methods to the current context.
  _.each(methods, function (method, verb) {
    context[verb] = httpRequest(nodes, method);
    context[verb][DESCRIPTION_PROPERTY] = toMethodDescription(nodes, method);
  });

  return context;
};

/**
 * Attach a special media extension handler.
 *
 * @param  {Array}  nodes
 * @param  {Object} context
 * @param  {Object} resource
 * @return {Object}
 */
var attachMediaTypeExtension = function (nodes, context, resource) {
  /**
   * Push the extension onto the current route and set relevant headers.
   *
   * @param  {String} extension
   * @return {Object}
   */
  context.extension = function (extension) {
    extension = extension == null ? '' : String(extension);

    // Prepend a period to the extension before adding to the route.
    if (extension && extension.charAt(0) !== '.') {
      extension = '.' + extension;
    }

    var newContext = {};
    var routeNodes = _.extend([], nodes);

    // Append the extension to the current route.
    routeNodes[routeNodes.length - 1] += extension;

    attachMethods(routeNodes, newContext, resource.methods);
    attachResources(routeNodes, newContext, resource.resources);

    return newContext;
  };

  // Attach a description and return property.
  context.extension[RETURN_PROPERTY]      = context.extension('');
  context.extension[DESCRIPTION_PROPERTY] = EXTENSION_DESCRIPTION;

  // If the media type extension is not required, allow direct invocation of
  // the request method.
  if (resource.uriParameters.mediaTypeExtension.required === false) {
    attachMethods(nodes, context, resource.methods);
  }

  // Iterate over the enum options and automatically attach to the context.
  _.each(resource.uriParameters.mediaTypeExtension.enum, function (extension) {
    if (extension.charAt(0) === '.') {
      extension = extension.substr(1);
    }

    context[extension] = context.extension(extension);
  });

  return context;
};

/**
 * Generate a context or attach methods and resources to an existing context.
 *
 * @param  {Array}   nodes
 * @param  {Object}  resource
 * @param  {Boolean} hasMediaExtension
 * @param  {Object}  [context]
 * @return {Object}
 */
var newContext = function (nodes, resource, hasMediaExtension, context) {
  context = context || {};

  if (hasMediaExtension) {
    attachMediaTypeExtension(nodes, context, resource);
  } else {
    attachMethods(nodes, context, resource.methods);
    attachResources(nodes, context, resource.resources);
  }

  return context;
};

/**
 * Recurses through a resource object in the RAML AST, generating a dynamic
 * DSL that only allows methods that were defined in the RAML spec.
 *
 * @param  {Array}  nodes
 * @param  {Object} context
 * @param  {Object} resources
 * @return {Object}
 */

/* jshint -W003 */
var attachResources = function (nodes, context, resources) {
  _.each(resources, function (resource, route) {
    var routeNodes        = _.extend([], nodes);
    var routeName         = route;
    var hasMediaExtension = route.substr(-20) === '{mediaTypeExtension}';

    // Ignore media type extensions in route generation.
    if (hasMediaExtension) {
      route = routeName = route.slice(0, -20);
    }

    // Check the route against our valid uri parameters.
    var templateTags = route.match(template.REGEXP);

    // Push the current route into the route array.
    routeNodes.push(route);

    // If we have template tags available, attach a dynamic route.
    if (templateTags) {
      var routeSuffix = templateTags.join('');

      // The route must end with the chained template tags and have no
      // text between tags.
      if (route.substr(-routeSuffix.length) !== routeSuffix) {
        return false;
      }

      // If the route is only a template tag with no static text, use the
      // template tag text as the method name.
      if (templateTags.length === 1 && route === templateTags[0]) {
        routeName = templateTags[0].slice(1, -1);
      } else {
        routeName = route.substr(0, route.indexOf('{'));
      }

      // Avoid adding empty route name cases. This can occur when we have
      // multiple tag names and no front text. For example, `{this}{that}`.
      // This could also occur if for some reason we are passing in a route that
      // isn't dynamic.
      if (!routeName) {
        return false;
      }

      // Get the ordered tag names for completion.
      var tags = _.map(templateTags, function (param) {
        return resource.uriParameters[param.slice(1, -1)];
      });

      // The route is dynamic, so we set the route name to be a function
      // which accepts the template arguments and updates the path fragment.
      // We'll extend any route already at the same namespace so we can do
      // things like use both `/{route}` and `/route`, if needed.
      context[routeName] = _.extend(function () {
        var args = arguments;

        // Map the tags to the arguments or default arguments.
        var parts = _.map(tags, function (tag, index) {
          // Inject enum parameters if there is only one available enum.
          // TODO: When/if we add validation back, have these routes
          // be generated instead of typed out.
          if (args[index] == null && tag.enum && tag.enum.length === 1) {
            return tag.enum[0];
          }

          // Use any passed in argument - even it's falsy.
          if (index in args) {
            return args[index];
          }

          var param = templateTags[index].slice(1, -1);

          // Fallback to injecting the fallback configuration uri parameter.
          return routeNodes.config && routeNodes.config.uriParameters[param];
        });

        // Change the last path fragment to the proper template text.
        routeNodes[routeNodes.length - 1] = template(route, parts);

        return newContext(routeNodes, resource, hasMediaExtension);
      }, context[routeName]);

      // Generate the description object for helping tooltip display.
      context[routeName][DESCRIPTION_PROPERTY] = {
        '!type': 'fn(' + _.map(tags, function (param) {
          return param.displayName + (param.required ? '' : '?');
        }).join(', ') + ')',
        '!args': _.map(tags, function (param) {
          return {
            '!type': param.type,
            '!doc':  param.description
          };
        }),
        '!doc': 'Dynamically inject variables into the request path.'
      };

      // Generate the return property for helping autocompletion.
      context[routeName][RETURN_PROPERTY] = newContext(
        routeNodes, resource, hasMediaExtension
      );

      return context[routeName];
    }

    // Handle root `/` resources.
    if (!routeName) {
      context = newContext(routeNodes, resource, hasMediaExtension, context);
    } else {
      context[routeName] = newContext(
        routeNodes, resource, hasMediaExtension, context[routeName]
      );
    }
  });

  return context;
};
/* jshint +W003 */

/**
 * Generate the client object from a sanitized AST object.
 *
 * @param  {Object} ast Passed through `sanitizeAST`
 * @param  {Object} config
 * @return {Object}
 */
var generateClient = function (ast, config) {
  // Generate the base uri parameters and defaults.
  var baseUriParameters = _.extend(
    {}, _.pick(ast, 'version'), config.baseUriParameters
  );

  // Generate the root node array. Set properties directly on this array to be
  // copied to the next execution part. We have a global configuration object
  // which can be altered externally at any point, as well as when we finally
  // make a request. For this reason, it's important that we use objects which
  // are passed by reference.
  var nodes = _.extend([], {
    config: _.extend({
      baseUri: ast.baseUri
    }, config, {
      baseUriParameters: baseUriParameters
    }),
    client: {
      securedBy:         ast.securedBy,
      authentication:    {},
      securitySchemes:   ast.securitySchemes,
      baseUriParameters: ast.baseUriParameters
    }
  });

  // Throw an error if the baseUri string is missing.
  if (!_.isString(nodes.config.baseUri)) {
    throw new Error('A "baseUri" string is required');
  }

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
      path || '', context || {}
    ).replace(/^\/+/, '').split('/');

    return attachMethods(_.extend([], nodes, route), {}, allHttpMethods);
  };

  client[CONFIG_PROPERTY]      = nodes.config;
  client[CLIENT_PROPERTY]      = nodes.client;
  client[DESCRIPTION_PROPERTY] = CLIENT_DESCRIPTION;
  client[RETURN_PROPERTY]      = attachMethods(nodes, {}, allHttpMethods);

  attachResources(nodes, client, ast.resources);

  return client;
};

/**
 * Exports the client generator, which accepts the AST of a RAML document.
 *
 * @return {Object} Dynamic object for constructing API requests from the AST.
 */
module.exports = function (ast, config) {
  return generateClient(sanitizeAST(ast), config);
};
