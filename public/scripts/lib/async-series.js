var _ = require('underscore');

/**
 * Runs an array of async task in a series. Returns a function that can be run
 * to break the execution loop.
 *
 * @param  {Array}    tasks
 * @param  {Function} done
 * @return {Function}
 */
module.exports = function (tasks, done, context) {
  // Ensures the passed in object is an array.
  tasks = _.toArray(tasks);
  // Keeps track of the current execution index and results.
  var index   = 0;
  var results = [];
  var breaker = false;
  // The next function is a simple async iterator that breaks iteration when
  // passed an error. Execute immediately to kick of the task runner.
  (function next (err, result) {
    // The loop has been intentionally broken, it can handle any issues that
    // occur as a result.
    if (breaker) {
      return _.isFunction(breaker) && breaker(err, results);
    }

    // If we have incremented an index (e.g. run some tasks), we should save the
    // result.
    if (index) { results.push(result); }

    var layer = tasks[index++];

    if (err || !layer) {
      return done.call(context, err, results);
    }

    try {
      layer(next);
    } catch (e) {
      next(e);
    }
  })();

  // Return a function that breaks the async series.
  return function (done) {
    breaker = done || true;
  };
};
