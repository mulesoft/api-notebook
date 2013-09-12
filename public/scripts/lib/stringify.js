var _      = require('underscore');
var typeOf = require('./type');

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
 * Used in nested stringifications such as the array and object, it will check
 * the object type and stringify accordingly. Always render primitives, while
 * objects will be stringified to their type output.
 *
 * @param  {*} object
 * @return {String}
 */
var stringifyByExpansion = function (object) {
  // If the object should be expanded to be viewed, just show the type
  if (_.isString(object)) { return stringifyString(object); }
  if (_.isObject(object)) { return Object.prototype.toString.call(object); }
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
    return stringifyByExpansion(value);
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
    return stringifyString(key) + ': ' + stringifyByExpansion(value);
  }, this).join(', ');

  return '{' + (objectString ? ' ' + objectString + ' ' : '') + '}';
};

/**
 * Stringify an error instance.
 *
 * @param  {Error} error
 * @return {String}
 */
var stringifyError = function (error) {
  // TIL DOMExceptions don't allow calling `toString` or string type coersion
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
module.exports = function (object) {
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
