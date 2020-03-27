var _          = require('underscore');
var DOMBars    = require('../lib/dombars');
var EditorCell = require('./editor-cell');
var ResultCell = require('./result-cell');
var Completion = require('../lib/completion');
var extraKeys  = require('./lib/extra-keys');
var controls   = require('../lib/controls').code;
var config     = require('../state/config');
var messages    = require('../state/messages');

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

  this.listenTo(config, 'codeReadOnly', function () {
    this.data.set('readOnly', config.get('codeReadOnly'));
    this.renderEditor();
  });

  this.listenTo(this.model, 'change:isError', function (model, isError) {
    this.el.classList[isError ? 'add' : 'remove']('cell-code-error');
  });

  // Set a static result cell instance.
  this.resultCell = new ResultCell({ model: this.model });
};

/**
 * Default cell model attributes.
 *
 * @type {Object}
 */
CodeCell.prototype.cellAttributes = {
  type: 'code'
};

/**
 * Merge the editor cell template with the code cell.
 *
 * @type {Function}
 */
CodeCell.prototype.template = DOMBars.Utils.mergeTemplates(
  EditorCell.prototype.template, require('../../templates/views/code-cell.hbs')
);

/**
 * Extend the editor cell with an event for triggering execute.
 *
 * @type {Object}
 */
CodeCell.prototype.events = _.extend({
  'click .cell-execute': function () {

    messages.trigger('cell:execute');

    return this.execute();
  }
}, EditorCell.prototype.events);

/**
 * Extend the editor cell controls with custom controls.
 *
 * @type {Array}
 */
CodeCell.prototype.cellControls = _.extend(
  [], EditorCell.prototype.cellControls
);

// Push the execute command into the menu.
CodeCell.prototype.cellControls.push(_.find(controls, function (control) {
  return control.command === 'execute';
}));

/**
 * Sets the options to be used by the CodeMirror instance when initialized.
 *
 * @type {Object}
 */
CodeCell.prototype.editorOptions = _.extend(
  {}, EditorCell.prototype.editorOptions, {
    mode: {
      name: 'javascript',
      globalVars: true
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
 * Update the result cell index calculation.
 *
 * @return {CodeCell}
 */
CodeCell.prototype.update = function () {
  this.resultCell.update();

  return EditorCell.prototype.update.call(this);
};

/**
 * Execute the code cell contents and render the result.
 *
 * @param {Function} done
 */
CodeCell.prototype.execute = function (done) {
  // Set the value as our own model for executing.
  this.model.set('value', this.editor.getValue());

  // First run previous cells if they need to be run.
  this.notebook.executePrevious(this, _.bind(function () {
    // Add a class to the cell to display execution.
    this.data.set('executing', true);
    this.trigger('executing', this);

    this.notebook.sandbox.execute(this.getValue(), _.bind(function (err, data) {
      this.data.set({
        executed:  true,
        executing: false
      });

      this.model.set({
        result:  data.result,
        isError: data.isError
      });

      this.change();
      this.trigger('execute', this, data);
      return done && done(err, data);
    }, this));
  }, this));
};

/**
 * Update the result cell rendering.
 */
CodeCell.prototype.change = function () {
  this.resultCell.change();

  return this;
};

/**
 * Create a new line in the editor.
 */
CodeCell.prototype.newLine = function () {
  this.editor.execCommand('newlineAndIndent');

  return this;
};

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

  return this;
};

/**
 * Remove all editor instance data.
 */
CodeCell.prototype.unbindEditor = function () {
  this._completion.remove();
  delete this._completion;
  return EditorCell.prototype.unbindEditor.call(this);
};

/**
 * Return the first line of the code editor.
 *
 * @return {Number}
 */
CodeCell.prototype.firstLine = function () {
  var prevCode = this.model.collection.getPrev(this.model);

  return prevCode ? prevCode.view.lastLine() + 1 : 1;
};
