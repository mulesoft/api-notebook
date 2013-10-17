var _            = require('underscore');
var Pos          = CodeMirror.Pos;
var middleware   = require('../../state/middleware');
var tokenHelpers = require('./token-helpers');
var correctToken = require('./correct-token');

/**
 * Proxy the return objects for the property and variable middleware and turn
 * it into something actionable for the widget display.
 *
 * @param  {Function} done
 * @return {Function}
 */
var completeResults = function (done) {
  return function (err, data) {
    // Sorts the keys and maps to an object that the widget can understand.
    var results = _.map(_.keys(data.results), function (key) {
      if (!_.isObject(data.results[key])) {
        return {
          name:  key,
          value: key
        };
      }

      return {
        name:    key,
        value:   data.results[key].value,
        special: data.results[key].special
      };
    }).sort(function (a, b) {
      if (a.special && b.special) {
        return a.value > b.value ? 1 : -1;
      } else if (a.special) {
        return 1;
      } else if (b.special) {
        return -1;
      }

      return a.value > b.value ? 1 : -1;
    });

    return done(err, {
      context: data.context,
      results: results
    });
  };
};

/**
 * Complete variable completion suggestions.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @param  {Object}     options
 * @param  {Function}   done
 */
var completeVariable = function (cm, token, options, done) {
  // Trigger the completion middleware to run
  middleware.trigger('completion:variable', _.extend({
    token:   token,
    editor:  cm,
    results: {}
  }, options), completeResults(done));
};

/**
 * Provides completion suggestions for a property.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @param  {Object}     options
 * @param  {Function}   done
 */
var completeProperty = function (cm, token, options, done) {
  tokenHelpers.getPropertyObject(cm, token, options, function (err, data) {
    middleware.trigger('completion:property', _.extend({
      results: {}
    }, data), completeResults(done));
  });
};

/**
 * Provides completion suggestions for function arguments.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     token
 * @param  {Object}     options
 * @param  {Function}   done
 */
var completeArguments = function (cm, token, options, done) {
  var prevToken = tokenHelpers.eatSpaceAndMove(cm, token);

  return tokenHelpers.getProperty(cm, prevToken, options, function (err, data) {
    if (err || !_.isFunction(data.context)) {
      return done(err);
    }

    middleware.trigger('completion:arguments', data, function (err, args) {
      // No arguments provided.
      if (err || !args.length) {
        return done(err);
      }

      // Set the results array to be a single object with the arguments
      // stringified.
      data.results = [{
        display: 'Arguments',
        value:   args.join(', ') + ')',
        special: true
      }];

      return completeResults(done)(err, data);
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
  var results = [];
  var type    = token.type;

  var cb = function (err, completion) {
    completion = completion || {};

    return done(err, {
      token:   token,
      context: completion.context,
      results: completion.results,
      to:      new Pos(cur.line, token.end),
      from:    new Pos(cur.line, token.start)
    });
  };

  if (type === null && token.string === '(') {
    return completeArguments(cm, token, options, cb);
  }

  if (type === 'keyword' || type === 'variable') {
    return completeVariable(cm, token, options, cb);
  }

  if (type === 'property') {
    return completeProperty(cm, token, options, cb);
  }

  return done();
};
