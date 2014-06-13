var middleware = require('../state/middleware');

/**
 * Function for displaying errors that occur to the user.
 *
 * @param {Error} err
 */
module.exports = function (title) {
  return function (err) {
    if (!err) { return; }

    return middleware.trigger('ui:notify', {
      title: title,
      message: err.message
    });
  };
};
