var _      = require('underscore');
var typeOf = require('./type');

/**
 * Gets internal object name. Works like the Chrome console and grabs the
 * contructor name to render with the preview.
 *
 * @param  {Object} object
 * @return {String}
 */
var getInternalName = (function () {
  var getName;

  // No need to use a regex if the `name` property is supported.
  if ('name' in Function.prototype) {
    getName = function (fn) {
      return fn.name;
    };
  } else {
    getName = function (fn) {
      // Run a quick regular expression to get the function name and return.
      return (/function\s+(.{1,})\s*\(/).exec(
        Function.prototype.toString.call(fn)
      )[1];
    };
  }

  return function (object) {
    // PhantomJS constructor are objects instead of functions.
    if (typeof object.constructor === 'object') {
      return Object.prototype.toString.call(object).slice(8, -1);
    }
    // Caters for `Object.create(null)`.
    return object.constructor ? getName(object.constructor) : 'Object';
  };
})();

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
 * Clone a dom node for stringification. Provides a little additional helps for
 * certain nodes that can't just be plain cloned.
 *
 * @param  {Node} node
 * @return {String}
 */
var cloneNode = function (node) {
  if (node.nodeType === Node.DOCUMENT_NODE) {
    var fragment = document.createDocumentFragment();
    for (var i = 0, len = node.childNodes.length; i < len; i++) {
      fragment.appendChild(cloneNode(node.childNodes[i]));
    }
    return fragment;
  }

  if (node.nodeType === Node.ATTRIBUTE_NODE) {
    return document.createTextNode(
      node.name + '=' + stringifyString(node.value)
    );
  }

  if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
    var doctype = [];
    doctype.push(node.nodeName);
    if (node.publicId) {
      doctype.push('PUBLIC', stringifyString(node.publicId));
    }
    if (node.systemId) {
      doctype.push(stringifyString(node.systemId));
    }
    return document.createTextNode('<!DOCTYPE ' + doctype.join(' ') + '>\n');
  }

  return node.cloneNode(true);
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
    var isList       = _.contains(
      [
        'Array',
        'NodeList',
        'HTMLCollection'
      ],
      internalName
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
 * @param  {Node} element
 * @return {String}
 */
var stringifyElement = function (element) {
  var div = document.createElement('div');
  // Not all elements are supported, so if we fail render it as an object.
  // TODO: Add support for addition node types.
  try {
    // Attempt to clone the node and append to a faux div to get the innerHTML.
    var node = cloneNode(element);
    div.appendChild(node);
    return div.innerHTML;
  } catch (e) {
    return stringifyObject(element);
  }
};

/**
 * Stringy any elements passed in for the inspector preview.
 *
 * @param  {*} object
 * @return {String}
 */
var stringify = module.exports = function (object) {
  switch (typeOf(object)) {
  case 'error':
    return stringifyError(object);
  case 'array':
    return stringifyArray(object);
  case 'object':
    return stringifyObject(object);
  case 'string':
    return stringifyString(object);
  case 'element':
    return stringifyElement(object);
  }

  // Every other type can safely be typecasted to the expected output
  return '' + object;
};

// Alias useful stringify functionality.
stringify.error   = stringifyError;
stringify.array   = stringifyArray;
stringify.object  = stringifyObject;
stringify.string  = stringifyString;
stringify.element = stringifyElement;

// Additional internal helpers.
stringify.stringifyChild  = stringifyChild;
stringify.getInternalName = getInternalName;
