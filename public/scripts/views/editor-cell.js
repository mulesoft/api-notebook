var _            = require('underscore');
var trim         = require('trim');
var Cell         = require('./cell');
var BtnControls  = require('./btn-cell-controls');
var extraKeys    = require('./lib/extra-keys');
var controls     = require('../lib/controls').editor;
var messages     = require('../state/messages');
var persistence  = require('../state/persistence');
var ownerProtect = require('./lib/owner-protect');

/**
 * Create a generic editor cell instance view.
 *
 * @type {Function}
 */
var EditorCell = module.exports = Cell.extend();

/**
 * Runs when we initialize the editor cell.
 */
EditorCell.prototype.initialize = function () {
  Cell.prototype.initialize.apply(this, arguments);
  this.model       = this.model || new this.EditorModel();
  this.model.view  = this;
  this.btnControls = new BtnControls();
};

/**
 * Sets a fallback model to initialize.
 *
 * @type {Function}
 */
EditorCell.prototype.EditorModel = require('../models/cell');

/**
 * Set the base editor options used in CodeMirror.
 *
 * @type {Object}
 */
EditorCell.prototype.editorOptions = {
  tabSize:        2,
  lineNumbers:    true,
  lineWrapping:   true,
  viewportMargin: Infinity,
  extraKeys:      extraKeys(controls)
};

/**
 * Remove the editor cell.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.remove = ownerProtect(function () {
  Cell.prototype.remove.call(this);
  messages.trigger('resize');

  return this;
});

/**
 * Moves the cells position in the notebook up by one cell.
 */
EditorCell.prototype.moveUp = ownerProtect(function () {
  this.trigger('moveUp', this);
});

/**
 * Moves the cells position in the notebook down by one cell.
 */
EditorCell.prototype.moveDown = ownerProtect(function () {
  this.trigger('moveDown', this);
});

/**
 * Navigate up to the previous cell with the cursor.
 */
EditorCell.prototype.navigateUp = ownerProtect(function () {
  this.trigger('navigateUp', this);
});

/**
 * Navigate down to the next cell with the cursor.
 */
EditorCell.prototype.navigateDown = ownerProtect(function () {
  this.trigger('navigateDown', this);
});

/**
 * Clones the editor cell and triggers a clone event with the cloned view.
 *
 * @return {EditorCell} Cloned view.
 */
EditorCell.prototype.clone = ownerProtect(function () {
  var clone = new this.constructor(_.extend({}, this.options, {
    model: this.model.clone()
  }));
  this.trigger('clone', this, clone);
  return clone;
});

/**
 * Triggers a `switch` event to switch the cell mode.
 */
EditorCell.prototype.switch = ownerProtect(function () {
  this.trigger('switch', this);
});

/**
 * Append a new editor cell directly below the current cell.
 */
EditorCell.prototype.appendNew = ownerProtect(function () {
  this.trigger('appendNew', this);
});

/**
 * Focus the editor cell.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.focus = function () {
  // Set a hidden focus flag so we can use it to check in tests
  this._hasFocus = true;
  // Make focusing the editor async since it triggers other events such as
  // scrolling into view which interferes with iframe resizing events.
  process.nextTick(_.bind(this.editor.focus, this.editor));
  return this;
};

/**
 * Check whether the current cell has focus.
 *
 * @return {Boolean}
 */
EditorCell.prototype.hasFocus = function () {
  return this._hasFocus || (!!this.editor && this.editor.hasFocus());
};

/**
 * Attempt to save the editor contents.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.save = function () {
  if (this.editor) {
    this.model.set('value', this.editor.getValue());
  }

  return this;
};

/**
 * Refresh the editor instance.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.refresh = function () {
  this.editor.refresh();

  return this;
};

/**
 * Set up bindings with the CodeMirror instance.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.bindEditor = function () {
  this.listenTo(this.editor, 'focus', _.bind(function () {
    delete this._hasFocus;

    if (this._triggerBlur) {
      window.clearTimeout(this._triggerBlur);
      return this._triggerBlur = null;
    }

    this.trigger('focus', this);
    this.el.classList.add('active');
  }, this));

  this.listenTo(this.editor, 'blur', _.bind(function () {
    this._triggerBlur = window.setTimeout(_.bind(function () {
      this.el.classList.remove('active');
      this.trigger('blur', this);
    }, this), 20);
  }, this));

  // Save the value of the model every time a change happens
  this.listenTo(this.editor, 'change', _.bind(function (cm, data) {
    this.save();

    // When the presented data looks line a new line has been added, emit an
    // event the notebook can listen to.
    if (data.text.length > 1 || data.from.line !== data.to.line) {
      messages.trigger('resize');
      this.trigger('linesChanged', this);
    }

    this.trigger('change', this, data);
  }, this));

  return this;
};

/**
 * Remove all bindings set up with the CodeMirror instance.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.unbindEditor = function () {
  this.stopListening(this.editor);
  window.clearTimeout(this._triggerBlur);
  this._triggerBlur = null;
  return this;
};

/**
 * Remove the CodeMirror view from the DOM.
 *
 * @param  {Boolean} copyDoc
 * @return {CodeMirror.Doc}
 */
EditorCell.prototype.removeEditor = function (copyDoc) {
  var editor = this.editor;
  var doc;

  if (editor) {
    this.unbindEditor();
    delete this.editor;

    if (copyDoc) {
      doc = editor.doc.copy(true);
    }

    // Remove the old CodeMirror instance from the DOM
    var editorEl = editor.getWrapperElement();
    if (editorEl && editorEl.parentNode) {
      editorEl.parentNode.removeChild(editorEl);
    }
  }

  return doc;
};

/**
 * Render a CodeMirror instance inside the view.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.renderEditor = function () {
  var doc, hasFocus;

  if (this.editor) {
    hasFocus = this.editor.hasFocus();
    doc      = this.removeEditor(true);
  }

  // If an editor already exists, rerender the editor keeping the same options
  // Initialize the codemirror editor
  this.editor = new CodeMirror(_.bind(function (el) {
    this.el.insertBefore(el, this.el.firstChild);
  }, this), _.extend({}, this.editorOptions, {
    view:     this,
    readOnly: !this.isOwner()
  }));

  // Move the state of the editor
  if (doc) {
    this.editor.swapDoc(doc);
  }

  // Alias the current view to the editor, since keyMaps are shared between
  // all instances of CodeMirror
  this.editor.view = this;

  // Set the editor value if it already exists
  if (this.getValue()) {
    this.editor.setValue(this.getValue());
    this.moveCursorToEnd();
  }

  // If it was previously focused, let's focus the editor again
  if (hasFocus) { this.focus(); }

  // Bind the editor events at the end in case of any focus issues when
  // changing docs, etc.
  this.bindEditor();

  return this;
};

/**
 * Render the editor cell and attach the controls.
 *
 * @return {EditorCell}
 */
EditorCell.prototype.render = function () {
  Cell.prototype.render.call(this);
  this.renderEditor();

  this.listenTo(this.btnControls, 'showControls', function () {
    this.trigger('showControls', this);
  }, this);
  this.btnControls.render().prependTo(this.el);

  return this;
};

/**
 * Get the current value of the cell.
 *
 * @return {String}
 */
EditorCell.prototype.getValue = function () {
  return this.model.get('value');
};

/**
 * Sets the value of the current editor instance.
 *
 * @param  {String}     value
 * @return {EditorCell}
 */
EditorCell.prototype.setValue = function (value) {
  if (_.isString(value)) {
    if (this.editor) {
      this.editor.setValue(value);
    } else {
      this.model.set('value', value);
    }
  }

  return this;
};

/**
 * Moves the CodeMirror cursor to the end of document, or end of the line.
 *
 * @param  {Number}     line
 * @return {EditorCell}
 */
EditorCell.prototype.moveCursorToEnd = function (line) {
  if (!this.editor) { return this; }

  this.editor.setCursor(
    isNaN(line) ? this.editor.doc.lastLine() : line,
    Infinity
  );

  return this;
};

/**
 * Appends the editor cell to an element.
 *
 * @param  {Node}       el
 * @return {EditorCell}
 */
EditorCell.prototype.appendTo = function (el) {
  Cell.prototype.appendTo.call(this, el);

  // Since the `render` method is called before being appended to the DOM, we
  // need to refresh the CodeMirror UI so it becomes visible
  if (this.editor) {
    this.refresh();
    // Since the CodeMirror refresh appears to be async, push the resize event
    // into the following event loop.
    process.nextTick(function () {
      messages.trigger('resize');
    });
  }

  return this;
};

/**
 * Checks whether the current user is the current owner of the cell and able to
 * edit it.
 *
 * @return {Boolean}
 */
EditorCell.prototype.isOwner = function () {
  return persistence.isOwner();
};
