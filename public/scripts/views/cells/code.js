var _          = require('underscore');
var Backbone   = require('backbone');
var EditorCell = require('./editor');
var ResultCell = require('./result');
var stripInput = require('../../lib/cm-strip-input');
var completion = require('../../lib/cm-sandbox-completion');
var extraKeys  = require('./lib/extra-keys');
var controls   = require('../../lib/controls').code;


var CodeCell = module.exports = EditorCell.extend({
  className: 'cell cell-code'
});

CodeCell.prototype.initialize = function () {
  EditorCell.prototype.initialize.apply(this, arguments);
  // Need a way of keeping the internal editor cell reference, since we can move
  // up and down between other statements.
  this._editorCid = this.model.cid;
  this.sandbox    = this.options.sandbox;
};

CodeCell.prototype.EditorModel = require('../../models/code-entry');

CodeCell.prototype.editorOptions = _.extend(
  {},
  EditorCell.prototype.editorOptions,
  {
    mode: 'javascript',
    lineNumberFormatter: function (line) {
      return String((this.view.startLine || 1) + line - 1);
    }
  }
);

CodeCell.prototype.editorOptions.extraKeys = _.extend(
  {}, EditorCell.prototype.editorOptions.extraKeys, extraKeys(controls)
);

CodeCell.prototype.save = function () {
  if (this._editorCid === this.model.cid) {
    this.model.set('value', this.editor.getValue());
  }
  return this;
};

CodeCell.prototype.refresh = function () {
  // Set the start and last line variables
  var prevCodeView = this.getPrevCodeView();
  this.startLine = _.result(prevCodeView, 'lastLine') + 1 || 1;
  this.lastLine  = this.startLine + this.editor.lastLine();
  // Call refresh on the editor
  EditorCell.prototype.refresh.call(this);
};

CodeCell.prototype.getNextCodeView = function () {
  if (this.model.collection) {
    return _.result(this.model.collection.getNextCode(this.model), 'view');
  }
};

CodeCell.prototype.getPrevCodeView = function () {
  if (this.model.collection) {
    return _.result(this.model.collection.getPrevCode(this.model), 'view');
  }
};

CodeCell.prototype.execute = function (cb) {
  var context = this.model.collection.serializeForEval();

  // Set the value as our own model for executing
  this.model.set('value', this.editor.getValue());
  this.browseToCell(this.model);

  this.sandbox.execute(this.getValue(), context, _.bind(function (err, result) {
    // Set the error or result to the inspector
    if (err) {
      this.result.setError(err, this.sandbox.window);
    } else {
      this.result.setResult(result, this.sandbox.window);
    }

    this.model.set('result', result); // Keep a reference to the result
    this.trigger('execute', this, err, result);

    if (cb) { cb(err, result); }
  }, this));

  return this;
};

CodeCell.prototype.browseUp = function () {
  if (this.editor.doc.getCursor().line === 0) {
    return this.trigger('browseUp', this, this._editorCid);
  }

  CodeMirror.commands.goLineUp(this.editor);
};

CodeCell.prototype.browseDown = function () {
  if (this.editor.doc.getCursor().line === this.editor.doc.lastLine()) {
    return this.trigger('browseDown', this, this._editorCid);
  }

  CodeMirror.commands.goLineDown(this.editor);
};

CodeCell.prototype.newLine = function () {
  CodeMirror.commands.newlineAndIndent(this.editor);
};

CodeCell.prototype.browseToCell = function (newModel) {
  this._editorCid = newModel.cid;
  this.setValue(newModel.get('value'));
};

CodeCell.prototype.autocomplete = function () {
  // Extends the context object our inline result references for autocompletion
  var context = Object.create(this.sandbox.window);
  _.extend(context, this.model.collection.serializeForEval());

  CodeMirror.showHint(this.editor, completion, {
    context: context,
    completeSingle: false
  });
};

CodeCell.prototype.bindEditor = function () {
  EditorCell.prototype.bindEditor.call(this);

  this.listenTo(this.editor, 'change', _.bind(function (cm, data) {
    this.lastLine = this.startLine + cm.lastLine();

    var commentBlock = stripInput('/*', cm, data);

    // When the comment block check doesn't return false, it means we want to
    // start a new comment block
    if (commentBlock !== false) {
      if (this.getValue()) { this.execute(); }
      return this.trigger('text', this, commentBlock);
    }

    // Trigger autocompletion on user events `+input` and `+delete`
    if (data.origin && data.origin.charAt(0) === '+') {
      return this.autocomplete();
    }
  }, this));

  return this;
};

CodeCell.prototype.render = function () {
  EditorCell.prototype.render.call(this);

  // Every code cell has an associated result
  this.result = new ResultCell({ model: this.model });
  this.result.render().appendTo(this.el);

  return this;
};
