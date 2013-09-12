var _ = require('underscore');

var OPEN_CODE_BLOCK  = '```javascript';
var CLOSE_CODE_BLOCK = '```';

/**
 * Sets up the base persistence middleware that can be overrriden in userland.
 *
 * @param  {Object} middleware
 */
module.exports = function (middleware) {
  /**
   * Serialize the notebook to a string based format.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('persistence:serialize', function (data, next) {
    data.notebook = _.map(data.notebook, function (cell) {
      if (cell.type === 'text') { return cell.value; }
      // Wrap code cells as a JavaScript code block for Markdown
      return [OPEN_CODE_BLOCK, cell.value, CLOSE_CODE_BLOCK].join('\n');
    }).join('\n\n');

    return next();
  });

  /**
   * Desserialize the notebook from a string into an array of cell data.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('persistence:deserialize', function (data, next) {
    var type       = 'text';
    var value      = [];
    var collection = [];

    var resetParser = function (newType) {
      // Text cells need to cater for the first line being empty since we are
      // joining the sections together with two newlines.
      if (type === 'text' && value[0] === '') {
        value.shift();
      }

      if (!value.length) { return type = newType; }

      value = value.join('\n');

      collection.push({
        type:  type,
        value: value
      });

      type  = newType;
      value = [];
    };

    _.each((data.notebook || '').split('\n'), function (line) {
      if (line === OPEN_CODE_BLOCK) {
        return resetParser('code');
      }

      if (type === 'code' && line === CLOSE_CODE_BLOCK) {
        return resetParser('text');
      }

      value.push(line);
    });

    // Done parsing, reset and empty the parser and asign the notebook contents
    resetParser();
    data.notebook = collection;

    return next();
  });

  /**
   * Default middleware that loads the initial notebook as a single code cell.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('persistence:load', function (data, next) {
    process.nextTick(function () {
      data.id       = null;
      data.notebook = [OPEN_CODE_BLOCK, '', CLOSE_CODE_BLOCK].join('\n');
      return next();
    });
  });
};
