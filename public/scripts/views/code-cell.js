var _            = require('underscore');
var Backbone     = require('backbone');
var EditorCell   = require('./editor-cell');
var ResultCell   = require('./result-cell');
var Completion   = require('../lib/completion');
var stripInput   = require('../lib/codemirror/strip-input');
var state        = require('../state/state');
var extraKeys    = require('./lib/extra-keys');
var controls     = require('../lib/controls').code;
var ownerProtect = require('./lib/owner-protect');

/**
 * Initialize a new code cell view.
 *
 * @type {Function}
 */
var CodeCell = module.exports = EditorCell.extend({
  className: 'cell cell-code'
});

/**
 * Runs when the code cell is initialized.
 */
CodeCell.prototype.initialize = function () {
  EditorCell.prototype.initialize.apply(this, arguments);
  // Need a way of keeping the internal editor cell reference, since we can move
  // up and down between other statements.
  this._editorCid = this.model.cid;
};

/**
 * Sets the editor model to fall back and initialize.
 *
 * @type {Function}
 */
CodeCell.prototype.EditorModel = require('../models/code-cell');

/**
 * Sets the options to be used by the CodeMirror instance when initialized.
 *
 * @type {Object}
 */
CodeCell.prototype.editorOptions = _.extend(
  {}, EditorCell.prototype.editorOptions, {
    mode: 'javascript',
    lineNumberFormatter: function (line) {
      return String((this.view.startLine || 1) + line - 1);
    }
  }
);

/**
 * Defines extra keys to be used by the editor for code cell.
 *
 * @type {Object}
 */
CodeCell.prototype.editorOptions.extraKeys = _.extend(
  {}, EditorCell.prototype.editorOptions.extraKeys, extraKeys(controls)
);

/**
 * Attempt to save the current cell contents. However, we need to have a safe
 * guard in place in case we have browsed to another cells contents and aren't
 * editing our own model.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.save = function () {
  if (this._editorCid === this.model.cid) {
    this.model.set('value', this.editor.getValue());
  }

  return this;
};

/**
 * Refreshes the code cell calculations. This includes things such as the length
 * of the code cell, position in the nodebook collection, etc.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.refresh = function () {
  var prevCodeView = this.getPrevCodeView();
  this.startLine = _.result(prevCodeView, 'lastLine') + 1 || 1;
  this.lastLine  = this.startLine + this.editor.lastLine();

  this.resultCell.refresh();
  return EditorCell.prototype.refresh.call(this);
};

/**
 * Returns the next code view in the notebook collection.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.getNextCodeView = function () {
  if (this.model.collection) {
    return _.result(this.model.collection.getNextCode(this.model), 'view');
  }
};

/**
 * Returns the previous code view in the notebook collection.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.getPrevCodeView = function () {
  if (this.model.collection) {
    return _.result(this.model.collection.getPrevCode(this.model), 'view');
  }
};

/**
 * Execute the code cell contents and render the result.
 *
 * @param {Function} done
 */
CodeCell.prototype.execute = function (done) {
  // Set the value as our own model for executing
  this.model.set('value', this.editor.getValue());

  // Make sure we have focus on the currently executing cell.
  if (!this.hasFocus()) {
    this.browseToCell(this.model);
    this.moveCursorToEnd();
  }

  this.notebook.sandbox.execute(this.getValue(), _.bind(function (err, data) {
    // Log any sandbox execution errors for the user to inspect.
    if (err && console) {
      console.error(err.toString());
    }

    if (data.isError) {
      this.model.unset('result');
    } else {
      this.model.set('result', data.result);
    }

    // Trigger `execute` and set the result, each of which need an additional
    // flag to indicate whether the the
    this.resultCell.setResult(data, this.notebook.sandbox.window);
    this.trigger('execute', this, data);
    return done && done(err, data);
  }, this));
};

/**
 * Browse up to the previous code view contents.
 */
CodeCell.prototype.browseUp = ownerProtect(function () {
  if (this.editor.doc.getCursor().line === 0) {
    return this.trigger('browseUp', this, this._editorCid);
  }

  CodeMirror.commands.goLineUp(this.editor);
});

/**
 * Browse down to the next code view contents.
 */
CodeCell.prototype.browseDown = ownerProtect(function () {
  if (this.editor.doc.getCursor().line === this.editor.doc.lastLine()) {
    return this.trigger('browseDown', this, this._editorCid);
  }

  CodeMirror.commands.goLineDown(this.editor);
});

/**
 * Create a new line in the editor.
 */
CodeCell.prototype.newLine = ownerProtect(function () {
  CodeMirror.commands.newlineAndIndent(this.editor);
});

/**
 * Browse to the contents of any code cell.
 *
 * @param  {Object}   newModel
 * @return {CodeCell}
 */
CodeCell.prototype.browseToCell = ownerProtect(function (newModel) {
  this._editorCid = newModel.cid;
  this.setValue(newModel.get('value'));

  return this;
});

/**
 * Set up the editor instance and bindings.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.bindEditor = function () {
  EditorCell.prototype.bindEditor.call(this);

  // Set up the autocompletion widget.
  this._completion = new Completion(
    this.editor, this.notebook.completionOptions
  );

  // Listen for code cells changes and update line numbers.
  this.listenTo(this, 'change', function (view, data) {
    this.lastLine = this.startLine + view.editor.lastLine();

    var commentBlock = stripInput('/*', view.editor, data);

    // When the comment block check doesn't return false, it means we want to
    // start a new comment block
    if (commentBlock !== false) {
      if (this.getValue()) { this.execute(); }
      return this.trigger('text', this, commentBlock);
    }
  }, this);

  return this;
};

/**
 * Remove all editor instance data.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.unbindEditor = function () {
  this._completion.remove();
  delete this._completion;
  return EditorCell.prototype.unbindEditor.call(this);
};

/**
 * Render the code cell and append a result cell to contain result data.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.render = function () {
  EditorCell.prototype.render.call(this);

  // Every code cell has an associated result
  this.resultCell = new ResultCell({ model: this.model });
  this.resultCell.render().appendTo(this.el);

  return this;
};
