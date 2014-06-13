var config = require('../../state/config');

/**
 * Export a function that wraps methods on an instance with a protection against
 * running when not the owner.
 *
 * @param  {Function} method
 * @return {Function}
 */
module.exports = function (method) {
  return function () {
    if (config.get('embedded')) {
      return this;
    }

    return method.apply(this, arguments);
  };
};
