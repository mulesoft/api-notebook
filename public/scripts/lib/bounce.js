/**
 * Execute a function and return it back directly after execution.
 *
 * @param  {Function} fn
 * @return {Function}
 */
module.exports = function (fn, context) {
  return fn.call(context), fn;
};
