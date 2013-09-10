var _      = require('underscore');
var typeOf = require('./type');

var stringifyString = function (string) {
  return '"' + string.replace(/"/g, '\\"') + '"';
};

var stringifyByExpansion = function (object) {
  // If the object should be expanded to be viewed, just show the type
  if (_.isString(object)) { return stringifyString(object); }
  if (_.isObject(object)) { return Object.prototype.toString.call(object); }
  return '' + object;
};

var stringifyArray = function (array) {
  return '[' + _.map(array, function (value) {
    return stringifyByExpansion(value);
  }, this).join(', ') + ']';
};

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

var stringifyError = function (error) {
  // TIL DOMExceptions don't allow calling `toString` or string type coersion
  return Error.prototype.toString.call(error);
};

var stringifyElement = function (element) {
  try {
    var div = document.createElement('div');
    div.appendChild(element.cloneNode(true));
    return div.innerHTML;
  } catch (e) {
    return stringifyObject(element);
  }
};

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
