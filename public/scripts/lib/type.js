module.exports = function (object) {
  switch (Object.prototype.toString.call(object)) {
  case '[object Function]':
    return 'function';
  case '[object Date]':
    return 'date';
  case '[object RegExp]':
    return 'regexp';
  case '[object Arguments]':
    return 'arguments';
  case '[object Array]':
    return 'array';
  case '[object String]':
    return 'string';
  case '[object Error]':
    return 'error';
  case '[object Number]':
    return 'number';
  }

  // Detect whether an object is an element using the `nodeType` property.
  if (object && object.nodeType === +object.nodeType) { return 'element'; }

  // Return a null type check or do the regular typeof.
  return object === null ? 'null' : typeof object;
};
