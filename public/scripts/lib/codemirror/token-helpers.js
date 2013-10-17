var _          = require('underscore');
var async      = require('async');
var getToken   = require('./get-token');
var middleware = require('../../state/middleware');

/**
 * Check whether the token is a possible accessor token (can read a result).
 *
 * @param  {Object}  token
 * @return {Boolean}
 */
var canAccess = function (token) {
  if (!_.contains([null, 'keyword', 'invalid'], token.type)) {
    return true;
  }

  return token.type === null && _.contains([')', ']'], token.string);
};

/**
 * Resolves tokens properly before use.
 *
 * @param {CodeMirror} cm
 * @param {Array}      tokens
 * @param {Object}     options
 * @param {Function}   done
 */
exports.resolveTokens = function (cm, tokens, options, done) {
  async.map(tokens, function (token, cb) {
    // Dynamic property calculations are run inline before we resolve the whole
    // object.
    if (token.type === 'dynamic-property') {
      return exports.propertyLookup(
        cm,
        token.tokens,
        options,
        function (err, data) {
          if (err) {  return cb(err); }

          var string;

          try {
            string = '' + data.context;
          } catch (e) {
            return cb(new Error('Property resolution is impossible'));
          }

          // Remove the tokens lookup array.
          delete token.tokens;

          // Returns a valid token for the rest of the resolution.
          return cb(err, _.extend(token, {
            type:   'property',
            string: string
          }));
        }
      );
    }

    return cb(null, token);
  }, done);
};

/**
 * Run property lookup middleware. *Please note: This assumes resolved tokens.*
 *
 * @param {CodeMirror} cm
 * @param {Array}      tokens
 * @param {Object}     options
 * @param {Function}   done
 */
var doPropertyLookup = function (cm, tokens, options, done) {
  var prevContext = options.context;

  middleware.trigger('completion:context', _.extend({
    token:   tokens.pop(),
    editor:  cm
  }, options), function again (err, data) {
    var token = data.token;

    // Break the context lookup.
    if (err) { return done(err, null); }

    // Update the parent context property.
    data.parent = prevContext;

    // Function context lookups occur after the property lookup.
    if (token && token.isFunction) {
      // Check that the property is also a function, otherwise we should
      // skip it and leave it up to the user to work out.
      if (!_.isFunction(data.context)) {
        data.token   = null;
        data.context = null;
        return again(err, data);
      }

      return middleware.trigger('completion:function', _.extend({
        name:          token.string,
        isConstructor: !!token.isConstructor
      }, data), function (err, context) {
        data.token   = tokens.pop();
        data.context = prevContext = context;

        // Immediately invoked functions should skip the context processing
        // step. It's also possible that this token was the last to process.
        if (data.token && data.token.type !== 'immed') {
          return middleware.trigger('completion:context', data, again);
        }

        return again(err, data);
      });
    }

    if (tokens.length && data.context != null) {
      data.token  = tokens.pop();
      prevContext = data.context;
      return middleware.trigger('completion:context', data, again);
    }

    return done(null, data);
  });
};

/**
 * Resolve the property lookup tokens.
 *
 * @param {CodeMirror} cm
 * @param {Array}      tokens
 * @param {Object}     options
 * @param {Function}   done
 */
exports.propertyLookup = function (cm, tokens, options, done) {
  // No tokens exist, which means we are doing a lookup at the global level.
  if (!tokens.length) {
    return done(null, _.extend({
      editor: cm
    }, options));
  }

  var invalid = _.some(tokens, function (token) {
    return token.type === 'invalid';
  });

  // If any invalid tokens exist, fail completion.
  if (invalid) {
    return done(new Error('Completion is not possible'));
  }

  // Run the property lookup functionality.
  exports.resolveTokens(cm, tokens, options, function (err, tokens) {
    if (err) { return done(err); }

    return doPropertyLookup(cm, tokens, options, done);
  });
};

/**
 * Verifies whether a given token is whitespace or not.
 *
 * @param  {Object}  token
 * @return {Boolean}
 */
exports.isWhitespaceToken = function (token) {
  return token.type === null && /^\s*$/.test(token.string);
};

/**
 * Returns the previous token in the editor, taking care to take into account
 * new lines.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Object}
 */
exports.getPrevToken = function (cm, token) {
  // Get the last token of the previous line. If we are at the beginning of the
  // editor already, return `null`.
  if (token.pos.ch === 0) {
    if (token.pos.line > 0) {
      return getToken(cm, {
        ch:   Infinity,
        line: token.pos.line - 1
      });
    } else {
      return null;
    }
  }

  return getToken(cm, token.pos);
};

/**
 * Returns the current token position, removing potential whitespace tokens.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Object}
 */
exports.eatSpace = function (cm, token) {
  while (token && exports.isWhitespaceToken(token)) {
    token = exports.getPrevToken(cm, token);
  }

  return token;
};

/**
 * Similar to `eatSpace`, but also takes moves the current token position.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Object}
 */
exports.eatSpaceAndMove = function (cm, token) {
  // No token, break.
  if (!token) { return token; }

  return exports.eatSpace(cm, exports.getPrevToken(cm, token));
};

/**
 * Gets the property context for completing a property by looping through each
 * of the context tokens. Provides some additional help by moving primitives to
 * their prototype objects so it can continue autocompletion.
 *
 * @param {CodeMirror} cm
 * @param {Object}     token
 * @param {Object}     options
 * @param {Function}   done
 */
exports.getPropertyObject = function (cm, token, options, done) {
  // Defer to the `getProperty` function.
  return exports.getProperty(
    cm, exports.eatSpaceAndMove(cm, token), options, done
  );
};

/**
 * Get the exact value of a token.
 *
 * @param {CodeMirror} cm
 * @param {Object}     token
 * @param {Object}     options
 * @param {Function}   done
 */
exports.getProperty = function (cm, token, options, done) {
  return exports.propertyLookup(
    cm, exports.getPropertyPath(cm, token), options, done
  );
};

/**
 * Get the full property path to a property token.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Array}
 */
exports.getPropertyPath = function (cm, token) {
  var context = [];

  /**
   * Mix in to with a token indicate an invalid/unexpected token.
   *
   * @type {Object}
   */
  var invalidToken = {
    type:   'invalid',
    string: null
  };

  /**
   * Eats the current token and any whitespace.
   *
   * @param  {Object} token
   * @return {Object}
   */
  var eatToken = function (token) {
    return exports.eatSpaceAndMove(cm, token);
  };

  /**
   * Resolves regular property notation.
   *
   * @param  {Object} token
   * @return {Object}
   */
  var resolveProperty = function (token) {
    context.push(token);
    return eatToken(token);
  };

  /**
   * Resolves square bracket notation.
   *
   * @param  {Object} token
   * @return {Object}
   */
  var resolveDynamicProperty = function (token) {
    var level = 1;
    var prev  = token;

    while (token && level > 0) {
      token = exports.getPrevToken(cm, token);
      if (token.string === ']') {
        level++;
      } else if (token.string === '[') {
        level--;
      }
    }

    // Keep track of the open token to confirm the location in the bracket
    // resolution.
    var startToken = token;
    token = eatToken(token);

    // Resolve the contents of the brackets as a text string.
    var string = cm.doc.getRange({
      ch:   startToken.start,
      line: startToken.pos.line
    }, {
      ch:   prev.end,
      line: prev.pos.line
    });

    // Only kick into bracket notation mode when the preceding token is a
    // property, variable, string, etc. Only things you can't use it on are
    // `undefined` and `null` (and syntax, of course).
    if (token && canAccess(token)) {
      if (eatToken(prev).string === '[') {
        context.push(_.extend(token, invalidToken));
        return token;
      }

      var subContext = exports.getPropertyPath(cm, eatToken(prev));
      var startPos   = eatToken(subContext[subContext.length - 1]).start;

      // Ensures that the only tokens being resolved can be done statically.
      if (startPos === startToken.start) {
        context.push(_.extend(prev, {
          start:  subContext[subContext.length - 1].start,
          end:    subContext[0].end,
          string: string,
          tokens: subContext,
          state:  prev.state,
          type:   'dynamic-property'
        }));
      } else {
        context.push(_.extend(token, invalidToken));
      }

      return token;
    }

    if (!token || token.type === null) {
      context.push({
        start:  startToken.start,
        end:    prev.end,
        string: string,
        state:  prev.state,
        type:   'array'
      });
    }

    return token;
  };

  /**
   * Resolves any other token types.
   *
   * @param  {Object} token
   * @return {Object}
   */
  var resolveOther = function (token) {
    context.push(token);
    return eatToken(token);
  };

  /**
   * Resolves the closing parenthesis to a possible function or context change.
   *
   * @param  {[type]} token [description]
   * @return {[type]}       [description]
   */
  var resolvePossibleFunction = function (token) {
    var level = 1;
    var prev  = token;

    // While still in parens *and not at the beginning of the editor*
    while (token && level > 0) {
      token = exports.getPrevToken(cm, token);
      if (token.string === ')') {
        level++;
      } else if (token.string === '(') {
        level--;
      }
    }

    // No support for resolving across multiple lines.. yet.
    if (level > 0) {
      context.push(_.extend(token, invalidToken));
      return token;
    }

    token = eatToken(token);

    // Resolves as a function argument.
    if (token && canAccess(token)) {
      // If the previous token was a function (E.g. the closing paren) it must
      // be an immediately invoked property.
      if (prev.isFunction) {
        context.push(_.extend(prev, {
          type:       'immed',
          string:     null,
          isFunction: true
        }));
      }

      token.isFunction = true;
      return token;
    }

    // Set `token` to be the token inside the parens and start working from
    // that instead.
    if (!token || token.type === null) {
      var subContext = exports.getPropertyPath(cm, eatToken(prev));

      // The context could be being invoked as a function.
      if (prev.isFunction && subContext.length) {
        subContext[0].isFunction = true;
      }

      // Ensure that the subcontext has correctly set the `new` flag.
      if (subContext.hasNew && subContext.length) {
        subContext[0].isFunction    = true;
        subContext[0].isConstructor = true;
      }

      context.push.apply(context, subContext);
      return false;
    }

    return eatToken(token);
  };

  while (token && (token.string === '.' || canAccess(token))) {
    // Skip over period notation.
    if (token.type === null && token.string === '.') {
      token = eatToken(token);
    }

    if (token.string === ']') {
      token = resolveDynamicProperty(token);
    } else if (token.string === ')') {
      token = resolvePossibleFunction(token);
    } else if (token.type === 'property') {
      token = resolveProperty(token);
    } else if (canAccess(token)) {
      token = resolveOther(token);
    } else {
      token = _.extend(token, invalidToken);
      context.push(token);
    }
  }

  // Using the new keyword doesn't actually require parens to invoke, so we need
  // to do a quick special case check here.
  if (token && token.type === 'keyword' && token.string === 'new') {
    context.hasNew = true;

    // Try to set the first function to be the constructor function.
    _.some(context, function (token) {
      if (!token.isFunction) { return; }

      // Remove the `hasNew` flag and set the function to be a constructor
      delete context.hasNew;
      return token.isConstructor = true;
    });
  }

  return context;
};
