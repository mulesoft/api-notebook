var _          = require('underscore');
var middleware = require('../../../state/middleware');

/**
 * Authenticate using basic auth.
 *
 * @param {Object}   options
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('authenticate', function (options, next, done) {
  if (options.type !== 'Basic Authentication') {
    return next();
  }

  if (!_.isString(options.username) || !_.isString(options.password)) {
    return next(new TypeError('Username and password must be defined'));
  }

  return done(null, _.pick(options, 'username', 'password'));
});

/**
 * Trigger an ajax request using basic auth configuration options.
 *
 * @param {Object}   data
 * @param {Function} next
 */
middleware.register('ajax:basicAuth', function (data, next) {
  // Check we have a basic auth object before mixing in our credentials.
  if (_.isObject(data.basicAuth)) {
    data.headers = _.extend({
      'Authorization': 'Basic ' + new Buffer(
        data.basicAuth.username + ':' + data.basicAuth.password
      ).toString('base64')
    }, data.headers);
  }

  return middleware.trigger('ajax', data, next);
});
