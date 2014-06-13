var varsHasValue = require('./vars-has-value');

/**
 * Check if a value is in the token scope.
 *
 * @param  {Object}  token
 * @param  {String}  value
 * @return {Boolean}
 */
module.exports = function (token, value) {
  var context    = token.state.context;
  var localVars  = token.state.localVars;
  var globalVars = token.state.globalVars;

  if (varsHasValue(localVars, value) || varsHasValue(globalVars, value)) {
    return true;
  }

  while (context) {
    if (varsHasValue(context.vars, value)) {
      return true;
    }

    context = context.prev;
  }

  return false;
};
