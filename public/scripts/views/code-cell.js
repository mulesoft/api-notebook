var _          = require('underscore');
var Backbone   = require('backbone');
var EditorCell = require('./editor-cell');
var ResultCell = require('./result-cell');
var Completion = require('../lib/completion');
var stripInput = require('../lib/codemirror/strip-input');
var state      = require('../state/state');
var extraKeys  = require('./lib/extra-keys');
var controls   = require('../lib/controls').code;
var middleware = require('../state/middleware');

var filterCompletion = function () {
  return this._completion.refresh();
};

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

CodeCell.prototype.EditorModel = require('../models/code-cell');

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
  var prevCodeView = this.getPrevCodeView();
  this.startLine = _.result(prevCodeView, 'lastLine') + 1 || 1;
  this.lastLine  = this.startLine + this.editor.lastLine();

  this.resultCell.refresh();
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

CodeCell.prototype.execute = function (done) {
  // Set the value as our own model for executing
  this.model.set('value', this.editor.getValue());
  // Make sure we have focus on the currently executing cell.
  if (!this.hasFocus()) {
    this.browseToCell(this.model);
    this.moveCursorToEnd();
  }

  // Trigger an event before execution
  this.trigger('beforeExecute', this);

  this.sandbox.execute(this.getValue(), _.bind(function (err, data) {
    if (err) { throw err; }

    if (data.isError) {
      this.model.unset('result');
    } else {
      this.model.set('result', data.result);
    }

    // Trigger `execute` and set the result, each of which need an additional
    // flag to indicate whether the the
    this.resultCell.setResult(data, this.sandbox.window);
    this.trigger('execute', this, data);
    return done && done(null, data);
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

CodeCell.prototype.bindEditor = function () {
  EditorCell.prototype.bindEditor.call(this);

  // Extends the context with additional inline completion results. Requires
  // using `Object.create` since you can't extend an object with every property
  // of the global object.
  var context = Object.create(this.sandbox.window);

  middleware.trigger('sandbox:context', context, _.bind(function (err, data) {
    // Set up the autocompletion widget.
    this._completion = new Completion(this.editor, {
      context: data
    });
  }, this));

  this.listenTo(state, 'change:showExtra', filterCompletion, this);

  this.listenTo(this.editor, 'change', _.bind(function (cm, data) {
    this.lastLine = this.startLine + cm.lastLine();

    var commentBlock = stripInput('/*', cm, data);

    // When the comment block check doesn't return false, it means we want to
    // start a new comment block
    if (commentBlock !== false) {
      if (this.getValue()) { this.execute(); }
      return this.trigger('text', this, commentBlock);
    }
  }, this));

  return this;
};

CodeCell.prototype.unbindEditor = function () {
  this._completion.remove();
  delete this._completion;
  this.stopListening(state, 'change:showExtra', filterCompletion);
  EditorCell.prototype.unbindEditor.call(this);
};

CodeCell.prototype.render = function () {
  EditorCell.prototype.render.call(this);

  // Every code cell has an associated result
  this.resultCell = new ResultCell({ model: this.model });
  this.resultCell.render().appendTo(this.el);

  return this;
};
