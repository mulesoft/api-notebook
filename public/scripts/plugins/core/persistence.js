var _ = require('underscore');

var OPEN_CODE_BLOCK     = '```javascript';
var CLOSE_CODE_BLOCK    = '```';
var META_DATA_DELIMITER = '---';

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
    var hasContent = false;

    // Prepend the front matter.
    data.contents = [
      META_DATA_DELIMITER,
      'title: ' + data.title,
      META_DATA_DELIMITER
    ].join('\n');

    // Split the markdown content from the front matter.
    data.contents += '\n\n';

    // Appends the notebook contents as Markdown.
    data.contents += _.chain(data.notebook)
      .slice()
      .reverse()
      .filter(function (cell) {
        if (!hasContent && !/^\s*$/.test(cell.value)) {
          hasContent = true;
        }

        return hasContent;
      })
      .reverse()
      .map(function (cell) {
        if (cell.type === 'text') { return cell.value; }
        // Wrap code cells as a JavaScript code block for Markdown
        return [OPEN_CODE_BLOCK, cell.value, CLOSE_CODE_BLOCK].join('\n');
      }).value().join('\n\n');

    return next();
  });

  /**
   * Desserialize the notebook from a string into an array of cell data.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('persistence:deserialize', function (data, next) {
    var metaData = new RegExp([
      '^',
      META_DATA_DELIMITER,
      '\\n(.*\\n)+',
      META_DATA_DELIMITER,
      '\\n'
    ].join(''));

    // Replace potential meta data with nothing and parse it separately.
    var content = data.contents.replace(metaData, function (content, body) {
      // Split each line of the metadata and set on the `data` export object.
      _.each(body.split('\n'), function (meta) {
        var parts = meta.split(': ');

        // Ignore the line if we don't have a `title: data` combination.
        if (parts.length === 2) {
          data[parts[0]] = parts[1];
        }
      });

      return '';
    });

    data.notebook = _.chain(content.split('\n')).reduce(function (cells, line) {
      var cell = cells[cells.length - 1];

      // An open code block will return a new code cell.
      if (line === OPEN_CODE_BLOCK) {
        cells.push({
          type:  'code',
          value: ''
        });

        return cells;
      }

      // If we hit a closing code block and we are a code cell, return a fresh
      // text cell.
      if (cell.type === 'code' && line === CLOSE_CODE_BLOCK) {
        cells.push({
          type:  'text',
          value: ''
        });

        return cells;
      }

      // Otherwise we can just append to the cell contents and return the cell.
      cell.value += line + '\n';
      return cells;
    }, [{
      type:  'text',
      value: ''
    }]).filter(function (cell, index, notebook) {
      cell.value = cell.value.slice(
        // Text cells will start with a new line.
        cell.type === 'text' && cell.value.charAt(0) === '\n' ? 1  : 0,
        // Text cells will have a trailing new line (if they aren't the last
        // cell in the whole notebook).
        cell.type === 'text' && index !== notebook.length - 1 ? -2 : -1
      );

      // Removes empty text cells.
      return !(cell.type === 'text' && cell.value === '');
    }).value();

    return next();
  });

  /**
   * Default middleware that loads the initial notebook as a single code cell.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('persistence:load', function (data, next) {
    data.contents = [
      OPEN_CODE_BLOCK, '', CLOSE_CODE_BLOCK
    ].join('\n');

    return next();
  });
};
