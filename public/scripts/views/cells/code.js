var _          = require('underscore');
var Backbone   = require('backbone');
var EditorCell = require('./editor');
var ResultCell = require('./result');
var stripInput = require('../../lib/cm-strip-input');
var completion = require('../../lib/cm-sandbox-completion');

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

CodeCell.prototype.execute = function () {
  var context = this.model.collection.serializeForEval();
  var err, result;

  try {
    result = this.sandbox.execute(this.getValue(), context);
    this.result.setResult(result, this.sandbox.window);
  } catch (e) {
    this.result.setError(err = e, this.sandbox.window);
  }

  this.save();
  this.model.set('result', result); // Keep a reference to the result
  this.trigger('execute', this, err, result);
};

CodeCell.prototype.editorOptions = _.extend(
  {},
  EditorCell.prototype.editorOptions,
  {
    mode: 'javascript'
  }
);

CodeCell.prototype.editorOptions.extraKeys = _.extend(
  {},
  CodeCell.prototype.editorOptions.extraKeys,
  {
    'Enter': function (cm) {
      cm.view.execute();
    },
    'Up': function (cm) {
      if (cm.doc.getCursor().line === 0) {
        return cm.view.browseUp();
      }
      CodeMirror.commands.goLineUp(cm);
    },
    'Down': function (cm) {
      if (cm.doc.getCursor().line === cm.doc.lastLine()) {
        return cm.view.browseDown();
      }
      CodeMirror.commands.goLineDown(cm);
    },
    // Alias shift enter to the normal enter behaviour
    'Shift-Enter': CodeMirror.keyMap.basic.Enter
  }
);

CodeCell.prototype.save = function () {
  if (this._editorCid === this.model.cid) {
    this.model.set('value', this.getValue());
  }
};

CodeCell.prototype.browseUp = function () {
  this.trigger('browseUp', this, this._editorCid);
};

CodeCell.prototype.browseDown = function () {
  this.trigger('browseDown', this, this._editorCid);
};

CodeCell.prototype.browseToCell = function (newModel) {
  this.save();
  this._editorCid = newModel.cid;
  // Grab the value from the editor if its not our own model, but if it is we
  // need to grab the value from the model itself. Otherwise there will be pain.
  if (this._editorCid === this.model.cid) {
    this.setValue(newModel.get('value'));
  } else {
    this.setValue(newModel.view.editor.getValue());
  }
};

CodeCell.prototype.autocomplete = function () {
  CodeMirror.showHint(this.editor, completion, {
    completeSingle: false
  });
};

CodeCell.prototype.render = function () {
  EditorCell.prototype.render.call(this);

  var _id = this.model._uniqueCellId;
  this.el.appendChild(Backbone.$('<div class="label">' + _id + '</div>')[0]);

  this.listenTo(this.editor, 'change', _.bind(function (cm, data) {
    var commentBlock = stripInput('/*', cm, data);
    // When the comment block check doesn't return false, it means we want to
    // start a new comment block
    if (commentBlock !== false) {
      this.trigger('text', this, commentBlock);
      if (this.getValue()) { this.execute(); }
    }
  }, this));

  this.listenTo(this.editor, 'change', _.bind(function (cm, data) {
    // Trigger autocompletion on user events `+input` and `+delete`
    if (data.origin && data.origin.charAt(0) === '+') {
      this.autocomplete();
    }
  }, this));

  // Every code cell has an associated result
  this.result = new ResultCell();
  this.result.render().appendTo(this.el);

  return this;
};
