var _           = require('underscore');
var marked      = require('marked');
var domify      = require('domify');
var Backbone    = require('backbone');
var EditorCell  = require('./editor-cell');
var messages    = require('../state/messages');
var stripInput  = require('../lib/codemirror/strip-input');
var insertAfter = require('../lib/browser/insert-after');

var TextCell = module.exports = EditorCell.extend({
  className: 'cell cell-text'
});

TextCell.prototype.events = _.extend({}, EditorCell.prototype.events, {
  'click': function () {
    if (!this.hasFocus) {
      this.focus();
    }
  }
});

TextCell.prototype.EditorModel = require('../models/text-cell');

TextCell.prototype.editorOptions = _.extend(
  {},
  EditorCell.prototype.editorOptions,
  {
    mode: 'gfm',
    theme: 'text-cell'
  }
);

TextCell.prototype.bindEditor = function () {
  EditorCell.prototype.bindEditor.call(this);

  this.listenTo(this.editor, 'change', _.bind(function (cm, data) {
    var endCommentBlock = stripInput('*/', cm, data);
    if (endCommentBlock !== false) {
      return this.trigger('code', this, endCommentBlock);
    }
  }, this));

  this.listenTo(this.editor, 'blur', _.bind(function (cm) {
    this.hasFocus = false;
    this.renderEditor();
  }, this));

  return this;
};

TextCell.prototype.refresh = function () {
  if (this.editor) {
    EditorCell.prototype.refresh.call(this);
  }
  return this;
};

TextCell.prototype.focus = function () {
  // Don't allow focusing on the editor if the user is not the owner
  if (!this.isOwner()) { return this; }

  this.hasFocus = true;
  this.renderEditor();
  return EditorCell.prototype.focus.call(this);
};

TextCell.prototype.setValue = function (value) {
  if (this.editor) {
    return EditorCell.prototype.setValue.apply(this, arguments);
  }

  // Rerender markdown cell
  this.model.set('value', value);
  return this.renderMarkdown();
};

TextCell.prototype.renderMarkdown = function () {
  this.removeMarkdown();

  this.markdownElement = this.el.insertBefore(
    domify('<div class="markdown"></div>'), this.el.firstChild
  );

  _.each(this.el.getElementsByClassName('comment'), function (el) {
    el.style.display = 'none';
  });

  marked(this.getValue(), {
    gfm: true,
    // highlight: function () {},
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
    langPrefix: 'lang-'
  }, _.bind(function (err, html) {
    try {
      html = domify(html);
    } catch (e) {
      html = document.createTextNode(html);
    }

    this.markdownElement.appendChild(html);
  }, this));

  return this;
};

TextCell.prototype.removeMarkdown = function () {
  if (this.markdownElement) {
    this.markdownElement.parentNode.removeChild(this.markdownElement);
    delete this.markdownElement;
  }

  _.each(this.el.getElementsByClassName('comment'), function (el) {
    el.style.display = 'block';
  });

  return this;
};

TextCell.prototype.renderEditor = function () {
  if (this.hasFocus) {
    this.removeMarkdown();
    EditorCell.prototype.renderEditor.call(this);
  } else {
    this.removeEditor();
    this.renderMarkdown();
  }

  process.nextTick(function () { messages.trigger('resize'); }, 0);

  return this;
};

TextCell.prototype.render = function () {
  EditorCell.prototype.render.call(this);

  this.el.appendChild(domify('<div class="comment comment-open">/*</div>'));
  this.el.appendChild(domify('<div class="comment comment-close">*/</div>'));

  return this;
};
