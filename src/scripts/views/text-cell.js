var _            = require('underscore');
var marked       = require('marked');
var domify       = require('domify');
var sanitizeHtml = require('sanitize-html');
var highlight    = require('highlight.js');
var EditorCell   = require('./editor-cell');
var config       = require('../state/config');
var messages     = require('../state/messages');
var embedProtect = require('./lib/embed-protect');

// Remove the html class prefix output.
highlight.configure({ classPrefix: '' });

/**
 * Create a new text cell instance.
 *
 * @type {Function}
 */
var TextCell = module.exports = EditorCell.extend({
  className: 'cell cell-text'
});

/**
 * Initialize the text cell and set default options.
 */
TextCell.prototype.initialize = function () {
  EditorCell.prototype.initialize.apply(this, arguments);

  this.listenTo(config, 'textReadOnly', function () {
    this.data.set('readOnly', !config.get('textReadOnly'));
    this.renderEditor();
  });
};

/**
 * Default cell model attributes.
 *
 * @type {Object}
 */
TextCell.prototype.cellAttributes = {
  type: 'text'
};

/**
 * Listen for events on text cell instances.
 *
 * @type {Object}
 */
TextCell.prototype.events = _.extend({
  'click .markdown': function (e) {
    if (this.hasFocus() || _.contains(['A', 'BUTTON'], e.target.tagName)) {
      return;
    }

    return this.focus();
  }
}, EditorCell.prototype.events);

/**
 * Options that will be passed to the CodeMirror instance.
 *
 * @type {Object}
 */
TextCell.prototype.editorOptions = _.extend(
  {},
  EditorCell.prototype.editorOptions,
  {
    mode:        'gfm',
    lineNumbers: false
  }
);

/**
 * Binds the CodeMirror instance with any listeners.
 *
 * @return {TextCell}
 */
TextCell.prototype.bindEditor = function () {
  EditorCell.prototype.bindEditor.call(this);

  // Listen to itself since editor cells have a built in protection here.
  this.listenTo(this, 'blur', this.renderEditor);

  return this;
};

/**
 * Focus the text cell instance. Render the CodeMirror instance.
 *
 * @return {TextCell}
 */
TextCell.prototype.focus = embedProtect(function (cursor) {
  EditorCell.prototype.renderEditor.call(this);
  this.editor.focus();

  // Set the closest cursor positions.
  if (cursor) {
    this.editor.doc.setSelection(cursor.start, cursor.end);
  }

  return this;
});

/**
 * Set the value of the text cell. Switches between updating the CodeMirror view
 * and the Markdown rendered preview.
 *
 * @param  {String}   value
 * @return {TextCell}
 */
TextCell.prototype.setValue = function (value) {
  EditorCell.prototype.setValue.call(this, value);

  return this.renderEditor();
};

/**
 * Remove the rendered Markdown cell and potential editor instance.
 *
 * @return {TextCell}
 */
TextCell.prototype.removeEditor = function () {
  if (this.markdownElement && this.markdownElement.parentNode) {
    this.markdownElement.parentNode.removeChild(this.markdownElement);
    delete this.markdownElement;
  }

  return EditorCell.prototype.removeEditor.call(this);
};

/**
 * Override the editor with a markdown viewer.
 *
 * @return {TextCell}
 */
TextCell.prototype.renderEditor = function () {
  if (!this.data.get('rendered')) {
    return;
  }

  this.removeEditor();

  this.markdownElement = domify('<div class="markdown"></div>');

  this.el.querySelector('.cell-content').appendChild(this.markdownElement);

  marked(this.getValue(), {
    gfm: true,
    highlight: function (code, lang) {
      try {
        if (highlight.getLanguage(lang)) {
          return highlight.highlight(lang, code).value;
        }

        return highlight.highlightAuto(code).value;
      } catch (e) {
        return code;
      }
    },
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    langPrefix: 'lang-'
  }, _.bind(function (err, html) {
    this.markdownElement.innerHTML = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
      allowedAttributes: {
        a: [ 'href', 'name', 'target' ],
        img: [ 'src', 'alt' ]
      },
    });
  }, this));

  messages.trigger('resize');

  return this;
};
