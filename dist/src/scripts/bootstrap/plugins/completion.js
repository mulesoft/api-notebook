var _          = require('underscore');
var middleware = require('../../state/middleware');
var isInScope  = require('../../lib/codemirror/is-in-scope');

/**
 * Reserved keyword list (http://mdn.io/reserved)
 *
 * @type {Object}
 */
var KEYWORDS = _.object(_.map(
  ('break case catch continue debugger default delete do else ' +
  'false finally for function if in instanceof new null return switch this ' +
  'throw true try typeof var void while with').split(' '),
  function (keyword) {
    return [keyword, {
      value: keyword,
      type: 'keyword'
    }];
  }
));

/**
 * CodeMirror provides access to inline variables defined within the notebook
 * using nested objects to represent each scope level in the editor. This will
 * squash the variables to a single level.
 *
 * @param  {Object} scope
 * @return {Object}
 */
var varsToObject = function (scope, info) {
  var obj = {};

  while (scope && scope.name) {
    obj[scope.name] = info || true;
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
 * Sadly we need to do some additional processing for primitive types and ensure
 * they will use the primitive prototype from the correct global context. This
 * is because primitives lose their prototypes when brought through iframes,
 * regardless of the origin.
 *
 * @param  {*}      object
 * @param  {Object} global
 * @return {Object}
 */
var mapObject = function (object, global) {
  // Sadly we need to do some additional help for primitives since the
  // prototype is lost between the iframe and main frame.
  if (typeof object === 'string') {
    return global.String.prototype;
  }

  if (typeof object === 'number') {
    return global.Number.prototype;
  }

  if (typeof object === 'boolean') {
    return global.Boolean.prototype;
  }

  return object;
};

/**
 * Returns a flat object of all valid JavaScript literal property names.
 *
 * @param  {Object} obj
 * @param  {Object} global
 * @return {Object}
 */
var getPropertyNames = function (context, global) {
  // Create with a null prototype, otherwise we have issues trying to set the
  // `__proto__` key.
  var props = Object.create(null);
  var obj   = context;

  /**
   * Adds the property to the property names object. Skips any property names
   * that aren't valid JavaScript literals since completion should not display
   * invalid JavaScript suggestions.
   *
   * @param {String} property
   */
  var addProp = function (property) {
    if (!isValidVariableName(property)) { return; }

    var prop = props[property] = {};

    // Checking typeof on the `window` prototype in Firefox 26 causes an error
    // to be thrown: "Illegal operation on WrappedNative prototype object".
    try {
      if (context[property] == null) {
        // Stringify `null` or `undefined`.
        prop.type = String(context[property]);
      } else {
        // Lookup from the current context object to avoid failures in Firefox.
        prop.type = typeof context[property];
      }
    } catch (e) {}

    prop.value = property;
  };

  // Sanitize the object to a type that we can grab keys from. If it still isn't
  // an object after being sanitized, break before we try to get keys.
  if (!_.isObject(obj = mapObject(obj, global))) {
    return props;
  }

  do {
    _.each(global.Object.getOwnPropertyNames(obj), addProp);
  } while (obj = global.Object.getPrototypeOf(obj));

  return props;
};

/**
 * Completes the completion variable suggestions.
 *
 * @param {Object}   data
 * @param {Function} next
 */
middleware.register('completion:variable', function (data, next) {
  var token = data.token;

  // Collect properties from the global environment first.
  _.extend(data.results, getPropertyNames(data.context, data.window));

  // Extend the results with global variables.
  _.extend(data.results, varsToObject(token.state.globalVars));

  // Extend the results with arguments from the local function context.
  _.extend(data.results, varsToObject(token.state.localVars, {
    type: 'argument'
  }));

  // Extend the variables object with each context level
  var context = token.state.context;
  while (context) {
    _.extend(data.results, varsToObject(context.vars));
    context = context.prev;
  }

  // Finally, extend over the top with keywords.
  _.extend(data.results, KEYWORDS);

  // Override the `arguments` definition (but only if we have one).
  if (data.results.arguments) {
    data.results.arguments = {
      type: 'object'
    };
  }

  return next();
});

/**
 * Augments the property completion data with all property names.
 *
 * @param {Object}   data
 * @param {Function} next
 */
middleware.register('completion:property', function (data, next) {
  _.extend(data.results, getPropertyNames(data.context, data.window));
  return next();
});

/**
 * Corrects the completion lookup context. Looks up variables/properties in
 * the global scope and coerces other types detected by CodeMirror (such as
 * strings and numbers) into the correct representation.
 *
 * Important: Needs to use the `global` property when recreating objects so
 * that middleware will continue to get the correct context. Otherwise you
 * will be switching global contexts to the main frame and there will be
 * discrepancies.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('completion:context', function (data, next, done) {
  var token  = data.token;
  var type   = token.type;
  var string = token.string;

  if (type === 'variable') {
    // Check if the current variable is a global or an argument.
    data.context = isInScope(token, string) ? null : data.context[string];
    return done();
  }

  if (type === 'property') {
    data.context = mapObject(data.context, data.window);
    data.context = data.context[string];
    return done();
  }

  if (type === 'array') {
    data.context = new data.window.Array();
    return done();
  }

  if (type === 'string') {
    data.context = data.window.String(string.slice(1, -1));
    return done();
  }

  if (type === 'number') {
    data.context = data.window.Number(string);
    return done();
  }

  if (type === 'string-2') {
    var parts = token.string.split('/');
    data.context = new data.window.RegExp(
      parts[1].replace('\\', '\\\\'), parts[2]
    );
    return done();
  }

  if (type === 'atom') {
    if (string === 'true' || string === 'false') {
      data.context = data.window.Boolean(string);
    } else if (string === 'null') {
      data.context = null;
    } else if (string === 'undefined') {
      data.context = undefined;
    }

    return done();
  }

  data.context = null;
  return done();
});

/**
 * Filter autocompletion suggestions. Checks the given suggestion is actually
 * the start of the current token.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('completion:filter', function (data, next, done) {
  var value  = data.result.value;
  var string = data.token.string;
  var length = value.length >= string.length;

  return done(null, length && value.substr(0, string.length) === string);
});
