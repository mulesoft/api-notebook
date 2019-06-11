var _          = require('underscore');
var View       = require('./view');
var messages   = require('../state/messages');
var CodeMirror = require('codemirror');

/**
 * Create a new raw notebook editor instance.
 *
 * @type {Function}
 */
var EditNotebook = module.exports = View.extend({
  className: 'notebook-edit'
});

/**
 * Render the notebook editor.
 *
 * @return {EditNotebook}
 */
EditNotebook.prototype.render = function () {
  this.editor = new CodeMirror(this.el, {
    mode:           'gfm',
    value:          this.model.get('content'),
    tabSize:        2,
    lineNumbers:    true,
    lineWrapping:   true,
    viewportMargin: Infinity
  });

  // Update the persistence code every time we change the content.
  this.listenTo(this.editor, 'change', _.bind(function (cm) {
    messages.trigger('resize');
    this.model.set('content', cm.getValue());
  }, this));

  this.listenTo(messages, 'refresh', _.bind(this.editor.refresh, this.editor));

  this.listenTo(this.model, 'change:content', function () {
    if (this.model.get('content') === this.editor.getValue()) { return; }

    this.editor.setValue(this.model.get('content'));
  });

  return this;
};
