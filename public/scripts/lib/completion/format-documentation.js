var marked = require('marked');

/**
 * Format the standard description object for rendering in the browser.
 *
 * @param  {Object} description
 * @param  {String} variable
 * @return {Object}
 */
module.exports = function (description, variable) {
  var formatted = {};

  if (description['!doc']) {
    formatted.doc = marked(description['!doc'], {
      gfm: true,
      tables: true,
      sanitize: true,
      smartLists: true
    });
  }

  if (description['!url']) {
    formatted.url = description['!url'];
  }

  if (description['!type']) {
    formatted.type = description['!type'];

    if (variable && /^fn\(/.test(formatted.type)) {
      formatted.type = variable + formatted.type.substr(2);
    }
  }

  return formatted;
};
