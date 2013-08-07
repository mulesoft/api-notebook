var _           = require('underscore');
var EditorCell  = require('./editor');
var stripInput  = require('../../lib/cm-strip-input');
var insertAfter = require('../../lib/insert-after');

var TextCell = module.exports = EditorCell.extend({
  className: 'cell cell-text'
});

TextCell.prototype.EditorModel = require('../../models/text-entry');

TextCell.prototype.editorOptions = _.extend(
  {},
  EditorCell.prototype.editorOptions,
  {
    mode: 'gfm',
    theme: 'text-cell'
  }
);

TextCell.prototype.closeCell = function (code) {
  this.alreadyClosed = true;
  this.trigger('code', this, code);
  this.el.classList.add('text-closed');
};

TextCell.prototype.render = function () {
  EditorCell.prototype.render.call(this);

  this.listenTo(this.editor, 'change', _.bind(function (cm, data) {
    var endCommentBlock = stripInput('*/', cm, data);
    // Set the value to the model every time a change happens
    this.model.set('value', this.getValue());
    // When we detect the closing comment block, set `this.alreadyClosed` -
    // since it doesn't make sense to be able to close it more than once
    if (endCommentBlock !== false) { this.closeCell(endCommentBlock); }
  }, this));

  return this;
};
