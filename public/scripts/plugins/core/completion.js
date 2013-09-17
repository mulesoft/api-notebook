var _ = require('underscore');

/**
 * Reserved keyword list (http://mdn.io/reserved)
 *
 * @type {Object}
 */
var keywords = _.object(('break case catch continue debugger default ' +
               'delete do else false finally for function if in instanceof' +
               'new null return switch throw true try typeof var void while ' +
               'with').split(' '), true);

/**
 * CodeMirror provides access to inline variables defined within the notebook
 * using nested objects to represent each scope level in the editor. This will
 * squash the variables to a single level.
 *
 * @param  {Object} scope
 * @return {Object}
 */
var varsToObject = function (scope) {
  var obj = {};

  while (scope) {
    // The scope variable could be the same token we are currently typing
    if (typeof scope.name === 'string') {
      obj[scope.name] = true;
    }
    scope = scope.next;
  }

  return obj;
};

/**
 * Checks if the variable name is valid.
 *
 * @param  {String}  name
 * @return {Boolean}
 */
var isValidVariableName = function (name) {
  return (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/).test(name);
};

/**
 * Returns a flat object of all valid JavaScript literal property names.
 *
 * @param  {Object} obj
 * @return {Object}
 */
var getPropertyNames = function (obj) {
  var props = {};
  var addProp;

  addProp = function (property) {
    // Avoid any property that is not a valid JavaScript literal variable,
    // since the autocompletion result wouldn't be valid JavaScript
    if (isValidVariableName(property)) { props[property] = true; }
  };

  do {
    _.each(Object.getOwnPropertyNames(obj), addProp);
  } while (obj = Object.getPrototypeOf(obj));

  return props;
};

/**
 * Registers all the core plugins for the completion widgets.
 *
 * @param  {Object} middleware
 */
module.exports = function (middleware) {
  /**
   * Completes the completion variable suggestions.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('completion:variable', function (data, next) {
    var token = data.token;

    _.extend(data.results, varsToObject(token.state.localVars));

    // Extend the variables object with each context level
    var prev = token.state.context;
    while (prev) {
      _.extend(data.results, varsToObject(prev.vars));
      prev = prev.prev;
    }

    _.extend(data.results, varsToObject(token.state.globalVars));
    _.extend(data.results, getPropertyNames(data.context), keywords);

    return next();
  });

  /**
   * Augments the property completion data with all property names.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('completion:property', function (data, next) {
    _.extend(data.results, getPropertyNames(data.context));
    return next();
  });

  /**
   * Corrects the completion lookup context. Looks up variables/properties in
   * the global scope and coerces other types detected by CodeMirror (such as
   * strings and numbers) into the correct representation.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('completion:context', function (data, next) {
    var token  = data.token;
    var type   = token.type;
    var string = token.string;

    if (type === 'variable' || type === 'property') {
      var context = data[type === 'variable' ? 'global' : 'context'];
      // Lookup the property on the current context
      data.context = context[string];
      // If the variable/property is a constructor function, we can provide
      // some additional context by looking at the `prototype` property.
      if (token.isFunction && token.isConstructor) {
        if (typeof data.context === 'function') {
          data.context = data.context.prototype;
        }
      }
      return next();
    }

    if (type === 'string') {
      data.context = String(string);
      return next();
    }

    if (type === 'number') {
      data.context = Number(string);
      return next();
    }

    if (type === 'string-2') {
      var parts = token.string.split('/');
      data.context = new RegExp(parts[1].replace('\\', '\\\\'), parts[2]);
      return next();
    }

    if (type === 'atom' && (string === 'true' || string === 'false')) {
      data.context = Boolean(string);
      return next();
    }

    data.context = null;
    return next();
  });

  /**
   * Filter autocompletion suggestions. Checks the given suggestion is actually
   * the start of the current token.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('completion:filter', function (data, next, done) {
    var str    = data.token.string;
    var longer = data.string.length >= str.length;

    return done(null, longer && data.string.substr(0, str.length) === str);
  });
};
