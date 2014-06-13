var DOMBars = require('dombars/runtime');

/**
 * Check whether all values in an array are equal.
 *
 * @param  {Array}   array
 * @return {Boolean}
 */
var isEqual = function (array) {
  for (var i = 1; i < array.length; i++) {
    if (array[0] !== array[i]) {
      return false;
    }
  }

  return true;
};

/**
 * Register as the equal helper.
 *
 * @return {*}
 */
DOMBars.registerHelper('equal', function (/* ...args, options */) {
  var args    = Array.prototype.slice.call(arguments);
  var options = args.pop();

  if (!options.fn) {
    return isEqual(args);
  }

  if (isEqual(args)) {
    return options.fn(this).value;
  }

  return options.inverse(this).value;
});

/**
 * Register the opposite not equal functionality.
 *
 * @return {*}
 */
DOMBars.registerHelper('unlessEqual', function (/* ...args, options */) {
  var options = arguments[arguments.length - 1];

  var args = Array.prototype.slice.call(arguments, 0, -1).concat({
    fn:      options.inverse,
    inverse: options.fn,
    hash:    options.hash
  });

  return DOMBars.helpers.equal.apply(this, args);
});
