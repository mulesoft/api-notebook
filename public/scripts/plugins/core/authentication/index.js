var oauth2 = require('./oauth2');

/**
 * Registers all core authentication middleware.
 *
 * @param {Object} middleware
 */
module.exports = function (middleware) {
  oauth2(middleware);
};
