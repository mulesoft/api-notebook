var _            = require('underscore');
var getToken     = require('./get-token');
var middleware   = require('../../state/middleware');
var tokenHelpers = require('./token-helpers');

/**
 * An map of possible function types.
 *
 * @type {Object}
 */
var FUNCTION_TYPES = {
  variable: true,
  property: true
};

/**
 * Collect data for displaying a tooltip. Passes an falsy value to the callback
 * to represent no data available to display.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     options
 * @param  {Function}   done
 */
module.exports = function (cm, options, done) {
  // Don't show the tooltip when we have have data selected.
  if (cm.doc.somethingSelected()) {
    return done();
  }

  var cur   = cm.getCursor();
  var token = getToken(cm, cur);
  var bracket;

  while (token) {
    bracket = tokenHelpers.getPrevBracket(cm, token);
    token   = bracket && tokenHelpers.eatEmptyAndMove(cm, bracket);

    if (!token || FUNCTION_TYPES[token.type]) {
      break;
    }
  }

  if (!token) {
    return done();
  }

  return tokenHelpers.getProperty(cm, token, options, function (err, data) {
    if (err || !_.isFunction(data.context)) {
      return done(err);
    }

    // When the context is a function, retrieve the relevant documentation.
    middleware.trigger('completion:describe', data, function (err, describe) {
      return done(err, _.extend(data, {
        description: describe,
        to:          cur,
        token:       bracket,
        from:        bracket.pos
      }));
    }, true);
  });
};
