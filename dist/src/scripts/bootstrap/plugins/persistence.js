/* global App */
var _          = require('underscore');
var config     = require('../../state/config');
var middleware = require('../../state/middleware');

var OPEN_CODE_BLOCK     = '```javascript';
var CLOSE_CODE_BLOCK    = '```';
var META_DATA_DELIMITER = '---';

/**
 * Set the default content into the config object.
 */
config.set('defaultContent', [
  OPEN_CODE_BLOCK,
  '',
  CLOSE_CODE_BLOCK
].join('\n'));

/**
 * Serialize the notebook to a string based format.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('persistence:serialize', function (data, next, done) {
  var hasContent = false;

  // Prepend the front matter.
  data.content = [
    META_DATA_DELIMITER,
    _.map(data.meta, function (value, key) {
      return key + ': ' + value;
    }).join('\n'),
    META_DATA_DELIMITER
  ].join('\n');

  // Split the markdown content from the front matter.
  data.content += '\n\n';

  // Appends the notebook content as Markdown.
  data.content += _.chain(data.cells)
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

  return done();
});

/**
 * Desserialize the notebook from a string into an array of cell data.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('persistence:deserialize', function (data, next, done) {
  var preambleRegExp = new RegExp([
    '^',
    META_DATA_DELIMITER,
    '\\n([\\S\\s]+?)\\n',
    META_DATA_DELIMITER,
    '\\n'
  ].join(''));

  // Replace potential meta data with nothing and parse it separately.
  var content = String(data.content || '')
    .replace(preambleRegExp, function (content, body) {
      // Split each line of the metadata and set on the `data` export object.
      _.each(body.split('\n'), function (meta) {
        var parts = meta.split(': ');

        // Ignore the line if we don't have a `title: data` combination.
        if (parts.length === 2) {
          data.meta[parts[0]] = parts[1];
        }
      });

      return '';
    });

  data.cells = _.chain(content.split('\n')).reduce(function (cells, line) {
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

    // Otherwise we can just append to the cell content and return the cell.
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

  return done();
});

/**
 * Default middleware that loads the initial notebook as a single code cell.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('persistence:load', function (data, next, done) {
  data.id      = null;
  data.content = config.get('defaultContent');

  return done();
});

/**
 * Add a "(cloned)" marker to cloned notebook titles.
 *
 * @param {Object}   data
 * @param {Function} next
 */
middleware.register('persistence:clone', function (data, next) {
  data.meta.title += ' (cloned)';

  return next();
});

/**
 * Clone the current notebook instance onto the notebook site.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('persistence:clone', function (data, next, done) {
  if (!config.get('embedded')) {
    return next();
  }

  App.postMessage.trigger('redirect', config.get('fullUrl'));

  return done();
});
