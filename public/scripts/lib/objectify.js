var each = require('foreach');

/**
 * Simple function to transform an array into an object. This is useful for
 * certain types of data and where it would be unreasonable to loop constantly
 * though an array we can do constant time lookups on an object.
 *
 * @param  {Array|String|Object} array
 * @return {Object}
 */
module.exports = function (array) {
  var obj = {};

  each(array, function (value) {
    obj[value] = true;
  });

  return obj;
};
