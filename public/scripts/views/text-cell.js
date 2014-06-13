var _            = require('underscore');
var marked       = require('marked');
var domify       = require('domify');
var EditorCell   = require('./editor-cell');
var config       = require('../state/config');
var messages     = require('../state/messages');
var embedProtect = require('./lib/embed-protect');

var blockRules  = marked.Lexer.rules;
var inlineRules = marked.InlineLexer.rules;

/**
 * Get all previous text to a focus node.
 *
 * @return {String}
 */
var getPrevText = function (node, offset, container) {
  var text = '';

  if (!container.contains(node)) {
    return text;
  }

  text += node.textContent.substr(0, offset);

  while (node !== container) {
    var temp    = '';
    var curNode = node;
    var sibling = (node = node.parentNode).firstChild;

    while (sibling !== curNode) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'BR') {
        temp += '\n';
      } else if (sibling.nodeType !== Node.COMMENT_NODE) {
        temp += sibling.textContent;
      }

      sibling = sibling.nextSibling;
    }

    text = temp + text;
  }

  return text;
};

/**
 * Find the text end position in a markdown document.
 *
 * @param  {String} text
 * @param  {String} markdown
 * @return {Object}
 */
var getTextPosition = function (text, markdown) {
  // Make a copy of the markdown which will be edited as we move along.
  var source   = markdown;
  var position = 0;
  var index    = 0;
  var m;

  while (index < text.length) {
    if (text[index] === source[0]) {
      index++;
      position++;
      source = source.substr(1);
      continue;
    }

    // Detect headings.
    if (m = /^( *#{1,6} *)([^\n]+?) *#* *(?:\n+|$)/.exec(source)) {
      if (index + m[2].length > text.length) {
        position += m[1].length + text.length - index;
        break;
      }

      index += m[2].length + 1;
      position += m[0].length;
      source = source.substr(m[0].length);
      continue;
    }

    // Correct links, images, autolinks.
    if (m = (
      inlineRules.link.exec(source) ||
      inlineRules.reflink.exec(source) ||
      inlineRules.autolink.exec(source)
    )) {
      // Ignore images in the output.
      if (m[0].charAt(0) === '!') {
        position += m[0].length;
        source = source.substr(m[0].length);
        continue;
      }

      // Handle the click position inside the link.
      if (index + m[1].length > text.length) {
        position += text.length - index + 1;
        break;
      }

      index += m[1].length;
      position += m[0].length;
      source = source.substr(m[0].length);
      continue;
    }

    // Correct code indentation.
    if (m = blockRules.code.exec(source)) {
      position += 4;
      source = source.substr(4);
      continue;
    }

    // Skip over heading underlines, definitions, block quotes, code fences,
    // lists, element tags.
    if (m = (
      / *[=\-]{2,} *(?:\n+|$)/.exec(source) ||
      blockRules.def.exec(source) ||
      /^ *> */.exec(source) ||
      /^ *(?:`{3,}|~{3,}) *(?:\S+)? *\n/.exec(source) ||
      /^(?:[*+-]|\d+\.) */.exec(source) ||
      blockRules.hr.exec(source) ||
      inlineRules.tag.exec(source)
    )) {
      position += m[0].length;
      source = source.substr(m[0].length);
      continue;
    }

    // Fix em, strong and code elements. Matches up to four times since
    // the marked parser is kind of relaxed on this.
    if (m = (
      /^([\*_]{1,4})([\*_]{0,4})([\s\S]+?)\2\1(?!\1)/.exec(source) ||
      /^(`+)(\s*)([\s\S]*?[^`])\s*\1(?!`)/.exec(source)
    )) {
      if (index + m[3].length > text.length) {
        position += text.length - index + m[1].length + m[2].length;
        break;
      }

      index += m[3].length;
      position += m[0].length;
      source = source.substr(m[0].length);
      continue;
    }

    // Skip over escape characters.
    if (m = inlineRules.escape.exec(source)) {
      position += 1;
      source = source.substr(1);
      continue;
    }

    // Fix trailing spaces at end of lines in markdown.
    if (m = /( +)(?:\n|$)/.exec(source)) {
      source = source.substr(m[1].length);
      position += m[1].length;
      continue;
    }

    // Fix spacing between elements in parsed markdown output.
    if (text.charAt(index) === '\n') {
      index += 1;
      continue;
    }

    break;
  }

  var line = 0;

  var ch = markdown.substr(0, position).replace(/.*\r?\n/g, function () {
    return line++, '';
  }).length;

  return {
    ch:   ch,
    line: line
  };
};

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

    var selection = window.getSelection();
    var positions = this.getPositions(selection, this.model.get('value'));

    return this.focus(positions);
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
    mode: 'gfm',
    theme: 'text-cell'
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
 * Return the positions of a selection node relative to markdown text.
 *
 * @return {Object}
 */
TextCell.prototype.getPositions = function (selection) {
  var focusText, anchorText;

  var positions    = {};
  var anchorNode   = selection.anchorNode;
  var focusNode    = selection.focusNode;
  var anchorOffset = selection.anchorOffset;
  var focusOffset  = selection.focusOffset;

  // Get the text leading up to the focus node.
  focusText = getPrevText(focusNode, focusOffset, this.markdownElement);
  positions.end = getTextPosition(focusText, this.getValue());

  if (anchorNode === focusNode && anchorOffset === focusOffset) {
    anchorText = focusText;
    positions.start = positions.end;
  } else {
    anchorText = getPrevText(anchorNode, anchorOffset, this.markdownElement);
    positions.start = getTextPosition(anchorText, this.getValue());
  }

  return positions;
};

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
  if (this.markdownElement) {
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
  this.removeEditor();

  this.markdownElement = this.el.insertBefore(
    domify('<div class="markdown"></div>'), this.el.firstChild
  );

  marked(this.getValue(), {
    gfm: true,
    // highlight: function () {},
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    langPrefix: 'lang-'
  }, _.bind(function (err, html) {
    this.markdownElement.innerHTML = html;
  }, this));

  messages.trigger('resize');

  return this;
};
