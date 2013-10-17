var oauth1 = require('./oauth1');
var oauth2 = require('./oauth2');

/**
 * Registers all core authentication middleware.
 *
 * @param {Object} middleware
 */
module.exports = function (middleware) {
  oauth1(middleware);
  oauth2(middleware);
};
