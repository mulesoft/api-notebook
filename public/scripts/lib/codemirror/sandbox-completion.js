var _            = require('underscore');
var Pos          = require('codemirror').Pos;
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
          title: key,
          value: key
        };
      }

      return {
        title: key,
        type:  data.results[key].type,
        value: data.results[key].value || key
      };
    }).sort(function (a, b) {
      return a.title > b.title ? 1 : -1;
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
    context: options.window,
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
 * Trigger the completion module by passing in the current CodeMirror instance.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     options
 * @param  {Function}   done
 */
module.exports = function (cm, options, done) {
  var cur   = cm.getCursor();
  var token = correctToken(cm, cur);
  var type  = token.type;

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

  if (type === 'keyword' || type === 'variable') {
    return completeVariable(cm, token, options, cb);
  }

  if (type === 'property') {
    return completeProperty(cm, token, options, cb);
  }

  return done();
};
