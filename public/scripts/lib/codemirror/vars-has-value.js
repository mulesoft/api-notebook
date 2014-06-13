/**
 * Check if the scope chain contains a specific value.
 *
 * @param  {Object}  scope
 * @param  {String}  value
 * @return {Boolean}
 */
module.exports = function (scope, value) {
  while (scope) {
    if (scope.name === value) {
      return true;
    }

    scope = scope.next;
  }

  return false;
};
