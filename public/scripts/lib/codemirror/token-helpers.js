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
  if (!_.contains([null, 'keyword', 'invalid', 'comment'], token.type)) {
    return true;
  }

  return token.type === null && _.contains([')', ']'], token.string);
};

/**
 * Returns the closest previous opening bracket token to the passed in token.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Object}
 */
exports.getPrevBracket = function (cm, token) {
  var level = 0;

  do {
    if (token.string === '(') {
      if (level === 0) {
        return token;
      }

      level--;
    } else if (token.string === ')') {
      level++;
    }
  } while (token = exports.getPrevToken(cm, token));

  return token;
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
    context: options.window,
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
      }, true);
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
    return done(new Error('Completion not available for object properties'));
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
 * Retrieve the previous token in the editor, taking into account new lines.
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
 * Check if the token is empty (not useful to parsing).
 *
 * @param  {Object}  token
 * @return {Boolean}
 */
exports.isEmptyToken = function (token) {
  return exports.isWhitespaceToken(token) || token.type === 'comment';
};

/**
 * Returns the current token position, removing potential whitespace tokens.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Object}
 */
exports.eatEmpty = function (cm, token) {
  while (token && exports.isEmptyToken(token)) {
    token = exports.getPrevToken(cm, token);
  }

  return token;
};

/**
 * Similar to `eatEmpty`, but also takes moves the current token position.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Object}
 */
exports.eatEmptyAndMove = function (cm, token) {
  // No token, break.
  if (!token) { return token; }

  return exports.eatEmpty(cm, exports.getPrevToken(cm, token));
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
    cm, exports.eatEmptyAndMove(cm, token), options, done
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
    type: 'invalid',
    string: null
  };

  /**
   * Eats the current token and any whitespace.
   *
   * @param  {Object} token
   * @return {Object}
   */
  var eatToken = function (token) {
    return exports.eatEmptyAndMove(cm, token);
  };

  /**
   * Resolves regular property notation.
   *
   * @param  {Object} token
   * @return {Object}
   */
  var resolveToken = function (token) {
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

    while (level > 0 && (token = exports.getPrevToken(cm, token))) {
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
   * Resolves the closing parenthesis to a possible function or context change.
   *
   * @param  {[type]} token [description]
   * @return {[type]}       [description]
   */
  var resolvePossibleFunction = function (token) {
    var level = 1;
    var prev  = token;

    // While still in parens *and not at the beginning of the editor*
    while (level > 0 && (token = exports.getPrevToken(cm, token))) {
      if (token.string === ')') {
        level++;
      } else if (token.string === '(') {
        level--;
      }
    }

    // No support for resolving across multiple lines.. yet.
    if (level > 0) {
      context.push(_.extend(token || {}, invalidToken));
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

    // Special case variable tokens since we don't want the context to continue
    // completing after we hit the beginning of the chain.
    if (token.type === 'variable') {
      token = resolveToken(token);
      break;
    }

    // Attempt to resolve a dynmaic property or array literal.
    if (token.string === ']') {
      token = resolveDynamicProperty(token);
      continue;
    }

    // Attempt to resolve a function invokation, simply using parenthesis to
    // enclose a property/variable, using the parenthesis with `new`, etc.
    if (token.string === ')') {
      token = resolvePossibleFunction(token);
      continue;
    }

    // Resolve any other property that allows access as normal.
    if (canAccess(token)) {
      token = resolveToken(token);
      continue;
    }

    // If we made it to this point, the token is invalid.
    token = _.extend(token, invalidToken);
    context.push(token);
    break;
  }

  // Using the new keyword doesn't actually require parens to invoke, so we need
  // to do a quick special case check here.
  if (token && token.type === 'keyword' && token.string === 'new') {
    context.hasNew = true;

    // Try to set the first function to be the constructor function. The
    // context array is in reverse, so we need to iterate accordingly.
    var length = context.length;

    while (length--) {
      // Remove the global context `hasNew` flag and set the found function
      // to be a constructor.
      if (context[length].isFunction) {
        delete context.hasNew;
        context[length].isConstructor = true;

        // Break before setting any other context properties.
        break;
      }
    }
  }

  return context;
};
