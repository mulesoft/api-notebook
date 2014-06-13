/* global App */
var _           = App.Library._;
var qs          = App.Library.qs;
var mime        = require('mime-component');
var escape      = require('escape-regexp');
var parser      = require('uritemplate');
var sanitizeAST = require('./sanitize-ast');

var CONFIG_PROPERTY = '!config';
var CLIENT_PROPERTY = '!client';

var JSON_REGEXP = /^application\/([\w!#\$%&\*`\-\.\^~]*\+)?json$/i;

var HTTP_METHODS         = ['get', 'head', 'put', 'post', 'patch', 'delete'];
var RETURN_PROPERTY      = '!return';
var DESCRIPTION_PROPERTY = '!description';
var CONFIG_OPTIONS       = [
  'body', 'proxy', 'uriParameters', 'baseUriParameters', 'headers', 'query'
];
var OVERRIDABLE_CONFIG_OPTIONS = _.object(['body', 'proxy'], true);

/**
 * Static description of the media type extension function.
 *
 * @type {Object}
 */
var EXTENSION_DESCRIPTION = {
  '!type': 'fn(extension)',
  '!args': [{
    '!type': 'string',
    '!doc': 'Set the file extension with relevant `Accept` header.'
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
    '!doc': 'Provide a url relative to the base uri.'
  }, {
    '!type': 'object',
    '!doc': 'Provide a data object to replace template tags in the `url`.'
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
 * Accepts a params object and transforms it into a regex for matching the
 * tokens in the route.
 *
 * @param  {Object} params
 * @return {RegExp}
 */
var uriParamRegex = function (params) {
  // Transform the params into a regular expression for matching.
  return new RegExp('{(' + _.map(_.keys(params), escape).join('|') + ')}', 'g');
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
    var index = 0;

    string = string.replace(uriParamRegex(params), function () {
      return '{' + (index++) + '}';
    });
  }

  return parser.parse(string).expand(context);
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
  var argument = isQueryMethod(method) ? 'query?' : 'body?';

  return [method, {
    '!type': 'fn(' + argument + ', options?, async?)'
  }];
}));

/**
 * Convert the RAML documentation to a string.
 *
 * @param  {Object} object
 * @return {String}
 */
var toMarkdownDescription = function (object, name) {
  var title = '**' + name + (object.required ? '' : '?') + ':** ';

  // If a type is available, italicise after the name.
  if (object.type) {
    title += '*' + object.type + '* ';
  }

  return title + (object.description || '');
};

/**
 * Transform a RAML method object into a tooltip documentation object.
 *
 * @param  {Array}  nodes
 * @param  {Object} method
 * @return {Object}
 */
var toMethodDescription = function (nodes, method) {
  var args    = [];
  var config  = [];
  var body    = '';
  var isQuery = isQueryMethod(method.method);
  var documentation;

  if (method.queryParameters) {
    documentation = _.map(method.queryParameters, function (query, name) {
      return '* ' + toMarkdownDescription(query, name);
    }).join('\n');

    if (isQuery) {
      body = documentation;
    } else {
      config.push('**query**', documentation);
    }
  }

  if (method.headers) {
    config.push(
      '**headers:**',
      _.map(method.headers, function (header, name) {
        return '* ' + toMarkdownDescription(header, name);
      }).join('\n')
    );
  }

  if (method.body) {
    documentation = _.map(method.body, function (body, contentType) {
      var title  = '**' + contentType + ':** ';
      var description;

      // Map form parameters to their descriptions.
      if (body) {
        description = _.map(
          body.formParameters, function (param, name) {
            return '* * ' + toMarkdownDescription(param, name);
          }
        ).join('\n');
      }

      return '* ' + title + (description ? '\n' + description : '?');
    }).join('\n');

    if (isQuery) {
      config.push('**body**', documentation);
    } else {
      body = documentation;
    }
  }

  if (nodes.client.baseUriParameters) {
    config.push(
      '**baseUriParameters**',
      _.map(nodes.client.baseUriParameters, function (param, name) {
        return '* ' + toMarkdownDescription(param, name);
      }).join('\n')
    );
  }

  config.push(
    '**proxy**', '*boolean* Disable the proxy for the current request.'
  );

  args.push({
    '!doc': body,
    '!type': 'object'
  }, {
    '!doc': config.join('\n\n'),
    '!type': 'object'
  }, {
    '!doc': 'Pass a function to make the request execute asynchonously.',
    '!type': 'fn(error, response)'
  });

  return _.extend({
    '!doc': method.description,
    '!args': args
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
      var value = header.join(':').trim();

      responseHeaders[name.toLowerCase()] = value;
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
  return (contentType || '').split(';')[0];
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
 * Map mime types to their parsers.
 *
 * @type {Object}
 */
var parse = [
  [JSON_REGEXP, JSON.parse],
  ['application/x-www-form-urlencoded', qs.parse]
];

/**
 * Map mime types to their serializers.
 *
 * @type {Object}
 */
var serialize = [
  [JSON_REGEXP, JSON.stringify],
  ['application/x-www-form-urlencoded', qs.stringify],
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
 * @return {Boolean}
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
  var body    = xhr.responseText;
  var headers = getAllReponseHeaders(xhr);

  // Automatically parse certain response types.
  body = (getMatch(parse, mime) || _.identity)(body);

  return {
    body:    body,
    status:  xhr.status,
    headers: headers
  };
};

/**
 * Returns a function that can be used to make ajax requests.
 *
 * @param  {String}   url
 * @return {Function}
 */
var httpRequest = function (nodes, method) {
  return function (body, config, done) {
    // Allow config to be omitted from arguments.
    if (_.isFunction(arguments[1])) {
      done   = arguments[1];
      config = null;
    }

    // Map configuration options and merge with the passed in object.
    config = _.object(CONFIG_OPTIONS, _.map(CONFIG_OPTIONS, function (option) {
      if (_.has(OVERRIDABLE_CONFIG_OPTIONS, option)) {
        return config && option in config ?
          config[option] : nodes.config[option];
      }

      var nodeOption   = nodes.config[option];
      var configOption = config && config[option];
      var sanitize     = sanitizeOption[option] || _.identity;

      return _.extend({}, sanitize(nodeOption), sanitize(configOption));
    }));

    var async   = !!done;
    var request = 'ajax';
    var mime    = getMime(findHeader(config.headers, 'Content-Type'));
    var baseUri = template(nodes.client.baseUri, {}, config.baseUriParameters);
    var fullUri = baseUri + '/' + nodes.join('/');

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

    // Set the correct `Content-Type` header, if none exists. Kind of random if
    // more than one exists - in that case I would suggest setting it yourself.
    if (!mime && typeof method.body === 'object') {
      config.headers['content-type'] = mime = _.keys(method.body).pop();
    }

    // If we have no accept header set already, default to accepting
    // everything. This is required because Firefox sets the base accept
    // header to essentially be `html/xml`.
    if (!findHeader(config.headers, 'accept')) {
      config.headers.accept = '*/*';
    }

    // If we were passed in data, attempt to sanitize it to the correct type.
    if (!isHost(config.body)) {
      var serializer = getMatch(serialize, mime || 'application/json');

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
      url:     fullUri,
      data:    config.body,
      async:   async,
      proxy:   config.proxy,
      method:  method.method,
      headers: config.headers
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
        return request = 'ajax:' + authType;
      }
    });

    // If the request is async, set the relevant function callbacks.
    if (async) {
      App._executeContext.timeout(Infinity);

      if (!_.isFunction(done)) {
        done = App._executeContext.async();
      }
    }

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
    // This is super jank for handling errors, etc.
    if (!async) {
      if (error) {
        throw error;
      }

      return response;
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
    // Prepend a period to the extension before adding to the route.
    if (extension.charAt(0) !== '.') {
      extension = '.' + extension;
    }

    var newContext  = {};
    var routeNodes  = _.extend([], nodes);
    var contentType = mime.lookup(extension);

    // Append the extension to the current route.
    routeNodes[routeNodes.length - 1] += extension;

    // Automagically set the correct accepts header. Needs to clone the config
    // object and the headers to avoid breaking references.
    if (contentType) {
      routeNodes.config = _.extend({}, routeNodes.config);
      routeNodes.config.headers = _.extend({}, routeNodes.config.headers);
      routeNodes.config.headers.accept = contentType;
    }

    attachMethods(routeNodes, newContext, resource.methods);
    attachResources(routeNodes, newContext, resource.resources);

    return newContext;
  };

  // Attach a description and return property.
  context.extension[RETURN_PROPERTY]      = context.extension('');
  context.extension[DESCRIPTION_PROPERTY] = EXTENSION_DESCRIPTION;

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
 * @param  {Object}  context
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
    var templateTags = route.match(uriParamRegex(resource.uriParameters));

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
        routeNodes[routeNodes.length - 1] = template(
          route, resource.uriParameters, parts
        );

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
            '!doc': param.description
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

    context[routeName] = newContext(
      routeNodes, resource, hasMediaExtension, context[routeName]
    );
  });

  return context;
};
/* jshint +W003 */

/**
 * Generate the client object from a sanitized AST object.
 *
 * @param  {Object} ast Passed through `sanitizeAST`
 * @return {Object}
 */
var generateClient = function (ast, config) {
  // Generate the root node array. Set properties directly on this array to be
  // copied to the next execution part. We have a global configuration object
  // which can be altered externally at any point, as well as when we finally
  // make a request. For this reason, it's important that we use objects which
  // are passed by reference.
  var nodes = _.extend([], {
    config: config || (config = {}),
    client: {
      baseUri:           ast.baseUri.replace(/\/+$/, ''),
      baseUriParameters: ast.baseUriParameters,
      securedBy:         ast.securedBy,
      authentication:    {},
      securitySchemes:   ast.securitySchemes
    }
  });

  // Set up the initial baseUriParameters configuration.
  config.baseUriParameters = _.extend(
    {}, config.baseUriParameters, _.pick(ast, 'version')
  );

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
