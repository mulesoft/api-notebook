var _            = require('underscore');
var Pos          = CodeMirror.Pos;
var middleware   = require('../../state/middleware');
var correctToken = require('./correct-token');

/**
 * Verifies whether a given token is whitespace or not.
 *
 * @param  {Object}  token
 * @return {Boolean}
 */
var isWhitespaceToken = function (token) {
  return token.type === null && /^ *$/.test(token.string);
};

/**
 * Returns the token at a given position.
 *
 * @param  {CodeMirror}     cm
 * @param  {CodeMirror.Pos} cur
 * @return {Object}
 */
var getToken = function (cm, cur) {
  return cm.getTokenAt(cur);
};

/**
 * Complete variable completion suggestions.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @param  {Object}     context
 * @param  {Function}   done
 */
var completeVariable = function (cm, token, context, done) {
  // Trigger the completion middleware to run
  middleware.trigger('completion:variable', {
    token:   token,
    editor:  cm,
    context: context,
    results: {}
  }, function (err, data) {
    return done(err, {
      context: data.context,
      results: _.keys(data.results).sort()
    });
  });
};

/**
 * Collects information about the current token context by traversing through
 * the CodeMirror editor. Currently it's pretty simplistic and only works over
 * a single line.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @return {Array}
 */
var getPropertyContext = function (cm, token) {
  var cur     = cm.getCursor();
  var tprop   = token;
  var context = [];
  var level, prev, subContext, eatSpace;

  // Since JavaScript allows any number of spaces between properties and parens,
  // we will need to eat the additional spaces.
  eatSpace = function () {
    var token = getToken(cm, new Pos(cur.line, tprop.start));

    if (token.type === null && /^ +$/.test(token.string)) {
      token = getToken(cm, new Pos(cur.line, token.start));
    }

    return token;
  };

  while (tprop.type === 'property') {
    tprop = eatSpace(tprop);
    if (tprop.string !== '.') { return []; }
    tprop = eatSpace(tprop);

    while (tprop.string === ')') {
      level = 1;
      prev  = tprop; // Keep track in case this isn't a function after all
      do {
        tprop = getToken(cm, new Pos(cur.line, tprop.start));
        switch (tprop.string) {
        case ')':
          level++;
          break;
        case '(':
          level--;
          break;
        }
      // While still in parens *and not at the beginning of the line*
      } while (level > 0 && tprop.start);

      tprop = eatSpace(tprop);
      // Do a simple additional check to see if we are trying to use a type
      // surrounded by parens. E.g. `(123).toString()`.
      if (tprop.type === 'variable' || tprop.type === 'property') {
        tprop.isFunction = true;
      // This case is a little tricky to work with since a function could
      // return another function that is immediately invoked.
      } else if (tprop.string === ')') {
        context.push({
          start: tprop.end,
          end: tprop.end,
          string: '',
          state: tprop.state,
          type: 'immed'
        });
      // Set `tprop` to be the token inside the parens and start working from
      // that instead. If the last token is a space though, we need to move
      // back a little further.
      } else {
        tprop = getToken(cm, new Pos(cur.line, prev.start));
        if (isWhitespaceToken(tprop)) {
          tprop = getToken(cm, new Pos(cur.line, tprop.start));
        }
        subContext = getPropertyContext(cm, tprop);
        // The subcontext has a new keyword, but a function was not found, set
        // the last property to be a constructor and function
        if (subContext.hasNew) {
          if (tprop.type === 'variable' || tprop.type === 'property') {
            tprop.isFunction    = true;
            tprop.isConstructor = true;
          }
        }
      }
    }

    context.push(tprop);
  }

  // Using the new keyword doesn't actually require parens to invoke, so we need
  // to do a quick special case check here
  if (tprop.type === 'variable') {
    prev = eatSpace(tprop);

    // Sets whether the variable is actually a constructor function
    if (prev.type === 'keyword' && prev.string === 'new') {
      context.hasNew = true;
      // Try to set a function to be a constructor function
      _.some(context, function (tprop) {
        if (!tprop.isFunction) { return; }
        // Remove the `hasNew` flag and set the function to be a constructor
        delete context.hasNew;
        return (tprop.isConstructor = true);
      });
    }
  }

  return context;
};

/**
 * Gets the property context for completing a property by looping through each
 * of the context tokens. Provides some additional help by moving primitives to
 * their prototype objects so it can continue autocompletion.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @param  {Object}     context
 * @param  {Function}   done
 */
var getPropertyObject = function (cm, token, context, done) {
  var tokens = getPropertyContext(cm, token);

  middleware.trigger('completion:context', {
    token:   tokens.pop(),
    editor:  cm,
    global:  context,
    context: context
  }, function again (err, data) {
    if (!err) {
      // Do some post processing work to correct primitive types
      if (typeof data.context === 'string') {
        data.context = String.prototype;
      } else if (typeof data.context === 'number') {
        data.context = Number.prototype;
      } else if (typeof data.context === 'boolean') {
        data.context = Boolean.prototype;
      }

      if (data.context && tokens.length) {
        data.token = tokens.pop();
        return middleware.trigger('completion:context', data, again);
      }
    }

    return done(err, data.context);
  });
};

/**
 * Provides completion suggestions for a property.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @param  {Object}     context
 * @param  {Function}   done
 */
var completeProperty = function (cm, token, context, done) {
  getPropertyObject(cm, token, context, function (err, context) {
    middleware.trigger('completion:property', {
      token:   token,
      editor:  cm,
      context: context,
      results: {}
    }, function (err, data) {
      return done(err, {
        context: data.context,
        results: _.keys(data.results).sort()
      });
    });
  });
};

/**
 * Trigger the completion module by passing in the current codemirror instance.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     options
 * @param  {Function}   done
 */
module.exports = function (cm, options, done) {
  var cur     = cm.getCursor();
  var token   = correctToken(cm, cur);
  var context = options.context || global;
  var results = [];
  var type    = token.type;

  var cb = function (err, completion) {
    return done(err, {
      list:    completion.results,
      token:   token,
      context: completion.context,
      to:      new Pos(cur.line, token.end),
      from:    new Pos(cur.line, token.start)
    });
  };

  if (type === 'keyword' || type === 'variable') {
    return completeVariable(cm, token, context, cb);
  }

  if (type === 'property') {
    return completeProperty(cm, token, context, cb);
  }

  return done();
};
