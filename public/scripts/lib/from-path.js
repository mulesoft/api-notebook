/**
 * Accepts an array of strings that represent a reference to a value on an
 * object. Supports passing an optional setter, to set the value.
 *
 * @param  {Object} object
 * @param  {Array}  path
 * @param  {*}      [setter]
 * @return {*}
 */
module.exports = function (object, path, setter) {
  var isSetter = arguments.length > 2;

  for (var i = 0; i < path.length; i++) {
    var prop = path[i];

    if (isSetter) {
      if (i === path.length - 1) {
        object[prop] = setter;
      } else if (!(prop in object)) {
        object[prop] = {};
      }
    }

    object = object[prop];
  }

  // Return the updated object reference.
  return object;
};
