var _       = require('underscore');
var typeOf  = require('./type');
var __slice = Object.prototype.toString;

/**
 * Get a functions name.
 *
 * @param  {Function} fn
 * @return {String}
 */
var getFunctionName = function (fn) {
  return fn.name;
};

if (!('name' in Function.prototype)) {
  getFunctionName = function (fn) {
    var fnString = Function.prototype.toString.call(fn);

    // Run a simple regular expression to get the function name and return.
    return (/function\s+(.{1,})\s*\(/).exec(fnString)[1];
  };
}

/**
 * Gets internal object name. Works like the Chrome console and grabs the
 * contructor name to render with the preview.
 *
 * @param  {Object} object
 * @return {String}
 */
var getInternalName = function (object) {
  var name = 'Object';

  if (object == null) {
    return '' + object;
  }

  do {
    // By default, get the object type using `Object.prototype.toString`. This
    // is the most consistent method for built-in types returning things like
    // `JSON`, `global`, `HTMLDocument`, etc.
    name = __slice.call(object).slice(8, -1);

    // If the native object type is simply `Object`, try a more advanced
    // way of getting the type from the constructor function. This is really
    // only useful in client defined code and constructors. Wrap the whole
    // check in a `try..catch` statement since we don't know who's constructor
    // we are accessing and if it'll throw an error (E.g. `window.parent`).
    if (name === 'Object') {
      try {
        if (__slice.call(object.constructor) === '[object Function]') {
          name = getFunctionName(object.constructor);
        }
      } catch (e) {}
    }
  } while (name === 'Object' && (object = Object.getPrototypeOf(object)));

  return name;
};

/**
 * Stringify a string.
 *
 * @param  {String} string
 * @return {String}
 */
var stringifyString = function (string) {
  return '"' + string.replace(/"/g, '\\"') + '"';
};

/**
 * Stringify a child object, Chrome-style. This stringifies non-primitives to
 * their base name and keep primitives the visibly the same.
 *
 * @param  {*}      object
 * @return {String}
 */
var stringifyChild = function (object) {
  // Objects are renders as their object types. However, some types are known
  // lists so we can add the length to the preview.
  if (_.isObject(object)) {
    var internalName = getInternalName(object);

    // Check if the element is usually a list-like object.
    var isList = _.contains(
      ['Array', 'NodeList', 'HTMLCollection'], internalName
    );

    return internalName + (isList ? '[' + object.length + ']' : '');
  }

  if (_.isString(object)) {
    return stringifyString(object);
  }

  return '' + object;
};

/**
 * Stringify an array as an array literal.
 *
 * @param  {Array} array
 * @return {String}
 */
var stringifyArray = function (array) {
  return '[' + _.map(array, function (value) {
    return stringifyChild(value);
  }, this).join(', ') + ']';
};

/**
 * Stringify an object. Only does shallow stringification of enumerable
 * properties.
 *
 * @param  {Object} object
 * @return {String}
 */
var stringifyObject = function (object) {
  // Using the `keys` function to grab all the keys and then iterate, otherwise
  // when stringifying something like the window, it tries to use numeric
  // indexes like an array because of the `length` property.
  var objectString = _.map(_.keys(object), function (key) {
    var value = object[key];
    return stringifyString(key) + ': ' + stringifyChild(value);
  }, this).join(', ');

  return getInternalName(object) + ' {' + objectString + '}';
};

/**
 * Stringify an error instance.
 *
 * @param  {Error} error
 * @return {String}
 */
var stringifyError = function (error) {
  // TIL DOMExceptions don't allow calling `toString`.
  return Error.prototype.toString.call(error);
};

/**
 * Stringify an element node. Handle every type of node, not just elements but
 * also strings and comments.
 *
 * @param  {Node}   node
 * @return {String}
 */
var stringifyElement = function (node) {
  // Stringify document nodes by stringifying all child nodes.
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return _.map(node.childNodes, function (childNode) {
      return stringifyElement(childNode);
    }).join('');
  }

  // Escape attribute node values. The name will already be escaped.
  if (node.nodeType === Node.ATTRIBUTE_NODE) {
    return node.name + '=' + stringifyString(node.value);
  }

  // The document type node needs manual concatination.
  if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
    var doctype = [node.nodeName];

    if (node.publicId) {
      doctype.push('PUBLIC', stringifyString(node.publicId));
    }

    if (node.systemId) {
      doctype.push(stringifyString(node.systemId));
    }

    return '<!DOCTYPE ' + doctype.join(' ') + '>';
  }

  // Not all elements can be appended, so if we fail render it as an object.
  // TODO: Track failures somewhere so I can add future support.
  try {
    var div = document.createElement('div');
    div.appendChild(node.cloneNode(true));
    return div.innerHTML;
  } catch (e) {
    return stringifyObject(node);
  }
};

/**
 * Stringy any elements passed in for the inspector preview.
 *
 * @param  {*} object
 * @return {String}
 */
var stringify = module.exports = function (object) {
  var type = typeOf(object);

  if (type === 'error') {
    return stringifyError(object);
  }

  if (type === 'array') {
    return stringifyArray(object);
  }

  if (type === 'object') {
    return stringifyObject(object);
  }

  if (type === 'string') {
    return stringifyString(object);
  }

  if (type === 'element') {
    var stringifiedElement = stringifyElement(object);

    // Ensure that stringified elements always have an output. Useful for cases
    // where we might be attempting to stringify an empty fragment.
    return stringifiedElement.trim() ? stringifiedElement : object.nodeName;
  }

  // Every other type can safely be typecasted to the expected output.
  return '' + object;
};

// Expose useful internal helpers.
stringify.stringifyChild  = stringifyChild;
stringify.getInternalName = getInternalName;
