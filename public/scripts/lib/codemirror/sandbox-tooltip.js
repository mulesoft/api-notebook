var _            = require('underscore');
var Pos          = CodeMirror.Pos;
var getToken     = require('./get-token');
var middleware   = require('../../state/middleware');
var tokenHelpers = require('./token-helpers');

/**
 * Returns the closest previous opening bracket token to the passed in token.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Object}
 */
var getPrevBracket = function (cm, token) {
  var level = 0;

  do {
    if (token.string === '(') {
      // Break the loop if we have found the matching bracket token.
      if (level === 0) {
        return token;
      }

      level--;
    } else if (token.string === ')') {
      level++;
    }
  } while (token = tokenHelpers.getPrevToken(cm, token));

  // By the time we hit here, we'll be returning `null`.
  return token;
};

/**
 * Cache the current token and return data for the lookup token.
 *
 * @type {Object}
 */
var cache = {
  data:  null,
  token: null
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

  var cur     = cm.getCursor();
  var token   = getToken(cm, cur);
  var bracket = getPrevBracket(cm, token);
  var before  = bracket && tokenHelpers.eatSpaceAndMove(cm, bracket);

  // No token before the bracket can be found.
  if (!before) {
    cache.data  = null;
    cache.token = null;
    return done();
  }

  // Check with the current cache object and serve the previous result if
  // possible.
  if (cache.token) {
    var cToken    = cache.token;
    var cachePos  = cToken.pos;
    var beforePos = before.pos;

    // Position is the same.
    if (beforePos.ch === cachePos.ch && beforePos.line === cachePos.line) {
      // Tokens are the same.
      if (before.type === cToken.type && before.string === cToken.string) {
        // Update the `to` position (where the cursor currently is) and return.
        return done(null, _.extend(cache.data, {
          to: cur
        }));
      }
    }
  }

  return tokenHelpers.getProperty(cm, before, options, function (err, data) {
    if (err || !_.isFunction(data.context)) {
      return done(err);
    }

    // If the context is a function, let's get the data available for the
    // tooltip and return it.
    middleware.trigger('completion:describe', data, function (err, describe) {
      // Cache the data since we'll be calling the method regular with no real
      // changes in argument positions or types.
      cache.token = before;
      cache.data  = {
        token:       token,
        context:     data.context,
        description: describe,
        to:          cur,
        from:        new Pos(cur.line, token.start)
      };

      return done(err, cache.data);
    });
  });
};
