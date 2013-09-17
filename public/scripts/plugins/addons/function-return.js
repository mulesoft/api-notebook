var RETURN_PROP = '@return';

/**
 * Filters `@return` from showing up in the inspector view.
 *
 * @param  {Object}   data
 * @param  {Function} next
 */
var inspectorFilterPlugin = function (data, next, done) {
  if (typeof data.parent === 'function' && data.property === RETURN_PROP) {
    return done(null, false);
  }

  return next();
};

/**
 * Augments the completion context to take into account the `@return` property.
 *
 * @param  {Object}   data
 * @param  {Function} next
 * @param  {Function} done
 */
var completionContextPlugin = function (data, next, done) {
  var token = data.token;
  var type  = token.type;

  if (type === 'immed' && typeof data.context === 'function') {
    data.context = data.context[RETURN_PROP];
    return done();
  }

  if (token.isFunction && (type === 'variable' || type === 'property')) {
    var property = data.context[token.string];
    if (typeof property === 'function' && RETURN_PROP in property) {
      data.context = property[RETURN_PROP];
      return done();
    }
  }

  return next();
};

/**
 * A { key: function } map of all middleware used in the plugin.
 *
 * @type {Object}
 */
var plugins = {
  'inspector:filter':   inspectorFilterPlugin,
  'completion:context': completionContextPlugin
};

/**
 * Attach the middleware to the application.
 *
 * @param {Object} middleware
 */
exports.attach = function (middleware) {
  middleware.use(plugins);
};

/**
 * Detaches the middleware from the application. Useful during tests.
 *
 * @param {Object} middleware
 */
exports.detach = function (middleware) {
  middleware.disuse(plugins);
};
