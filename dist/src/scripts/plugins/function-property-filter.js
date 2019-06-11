var RETURN_PROP      = '!return';
var DESCRIPTION_PROP = '!description';

/**
 * Filters `@return` from showing up in the inspector view.
 *
 * @param {Object}   data
 * @param {Function} next
 */
exports['inspector:filter'] = function (data, next, done) {
  if (data.property === DESCRIPTION_PROP) {
    return done(null, false);
  }

  if (typeof data.parent === 'function' && data.property === RETURN_PROP) {
    return done(null, false);
  }

  return next();
};

/**
 * Augments the completion context to take into account the return property.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
exports['completion:function'] = function (data, next, done) {
  // Completes the using return property on functions, when available.
  if (RETURN_PROP in data.context) {
    return done(null, data.context[RETURN_PROP]);
  }

  return next();
};

/**
 * Provide a hook for completing descriptions from the description property.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
exports['completion:describe'] = function (data, next, done) {
  if (DESCRIPTION_PROP in data.context) {
    return done(null, data.context[DESCRIPTION_PROP]);
  }

  return next();
};
