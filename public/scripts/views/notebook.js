var _        = require('underscore');
var trim     = require('trim');
var View     = require('./view');
var Backbone = require('backbone');

var CodeView           = require('./code-cell');
var TextView           = require('./text-cell');
var EditorView         = require('./editor-cell');
var CellControls       = require('./cell-controls');
var EntryModel         = require('../models/cell');
var NotebookCollection = require('../collections/notebook');

var Sandbox     = require('../lib/sandbox');
var insertAfter = require('../lib/browser/insert-after');
var middleware  = require('../state/middleware');
var persistence = require('../state/persistence');

var completionMiddleware = require('../lib/sandbox-completion');

/**
 * Generates a generic function for appending new view instances.
 *
 * @param  {Backbone.View} View
 * @return {Function}
 */
var appendNewView = function (View) {
  return function (el, value) {
    var view = new View();
    this.appendView(view, el);
    view.setValue(value || '').moveCursorToEnd();

    return view;
  };
};

/**
 * Create a new notebook instance.
 *
 * @type {Function}
 */
var Notebook = module.exports = View.extend({
  className: 'notebook'
});

/**
 * Runs when a new notebook instance is created.
 *
 * @param  {Object} options
 */
Notebook.prototype.initialize = function (options) {
  this.sandbox    = new Sandbox();
  this.controls   = new CellControls().render();
  this.collection = new NotebookCollection();

  // Set up autocompletion environment.
  this.completionOptions = {
    global: this.sandbox.window
  };
  this.updateCompletion();

  // Get the middleware listeners for autocompletion and attach.
  this.sandboxCompletion = completionMiddleware(this.sandbox.window);

  // Attach the sandbox specific completion as middleware.
  this.sandboxCompletion.attach(middleware);

  // When the user changes, we may have been given permission to do things like
  // edit the notebook. Hence, we need to rerender certain aspects of the app.
  this.listenTo(persistence, 'changeUser',     this.updateUser);
  this.listenTo(persistence, 'changeNotebook', this.render);
};

/**
 * Removes the notebook from the DOM.
 *
 * @return {Notebook}
 */
Notebook.prototype.remove = function () {
  persistence.reset();
  this.sandbox.remove();
  this.sandboxCompletion.detach(middleware);

  // Remove references
  delete this.sandbox;
  delete this.controls;
  delete this.collection;
  delete this.completionOptions;
  delete this.sandboxCompletion;

  return View.prototype.remove.call(this);
};

/**
 * Update the notebook contents and save to the persistence layer.
 *
 * @param {Function} done
 */
Notebook.prototype.update = function () {
  persistence.set('notebook', this.collection.toJSON());
};

/**
 * Updates the current users display status. E.g. Unauthorized users can't
 * edit notebook cells.
 *
 * @return {Notebook}
 */
Notebook.prototype.updateUser = function () {
  this.collection.each(function (model) {
    model.view.renderEditor();
  });

  return this;
};

/**
 * Refresh the completion context object, used by the completion helper in code
 * cells to get completion results.
 *
 * @return {Notebook}
 */
Notebook.prototype.updateCompletion = function () {
  // Extends the context with additional inline completion results. Requires
  // using `Object.create` since you can't extend an object with every property
  // of the global object.
  var context = Object.create(this.sandbox.window);

  middleware.trigger('sandbox:context', context, _.bind(function (err, data) {
    this.completionOptions.context = data;
  }, this));

  return this;
};

/**
 * Render the notebook view.
 *
 * @return {Notebook}
 */
Notebook.prototype.render = function () {
  this.stopListening(this.collection);
  this.collection.each(function (model) {
    model.view.remove();
  });

  View.prototype.render.call(this);
  this.collection = new NotebookCollection();

  // Empty all the current content to reset with new contents
  _.each(persistence.get('notebook'), function (cell) {
    var appendView = 'appendCodeView';
    if (cell.type === 'text') { appendView = 'appendTextView'; }
    this[appendView](null, cell.value);
  }, this);

  if (!this.collection.length) {
    this.appendCodeView();
  }

  // Start listening for changes again.
  this.listenTo(this.collection, 'remove sort',        this.updateCompletion);
  this.listenTo(this.collection, 'remove sort change', this.update);

  return this;
};

/**
 * Append the notebook view to an element.
 *
 * @return {Notebook}
 */
Notebook.prototype.appendTo = function () {
  View.prototype.appendTo.apply(this, arguments);

  // Any editor cells will need refreshing to display properly.
  this.collection.each(function (model) {
    if (model.view && model.view.editor) {
      model.view.editor.refresh();
    }
  });

  return this;
};

/**
 * Execute the entire notebook sequentially.
 *
 * @param  {Function} done
 */
Notebook.prototype.execute = function (done) {
  var that = this;
  this._execution = true;

  // This chaining is a little awkward, but it allows the execution to work with
  // asynchronous callbacks.
  (function execution (view) {
    // If no view is passed through, we must have hit the last view.
    if (!view) {
      that._execution = false;
      return done && done();
    }

    // Only execute code cells, skips other cell types.
    if (view.model.get('type') === 'code') {
      view.focus().moveCursorToEnd();

      view.execute(function (err, data) {
        execution(that.getNextView(view));
      });
    } else {
      execution(that.getNextView(view));
    }
  })(this.collection.at(0).view);
};

/**
 * Returns the next view in the notebook.
 *
 * @param  {Object} view
 * @return {Object}
 */
Notebook.prototype.getNextView = function (view) {
  var model = this.collection.getNext(view.model);
  return model && model.view;
};

/**
 * Returns the previous view in the notebook.
 *
 * @param  {Object} view
 * @return {Object}
 */
Notebook.prototype.getPrevView = function (view) {
  var model = this.collection.getPrev(view.model);
  return model && model.view;
};

/**
 * Refresh all notebook cells from the current view instance.
 *
 * @param  {Object}   view
 * @return {Notebook}
 */
Notebook.prototype.refreshFromView = function (view) {
  do {
    view.refresh();
  } while (view = this.getNextView(view));

  return this;
};

/**
 * Append a new code cell view instance.
 */
Notebook.prototype.appendCodeView = appendNewView(CodeView);

/**
 * Append a new text cell view instance.
 */
Notebook.prototype.appendTextView = appendNewView(TextView);

/**
 * Append any view to the notebook. Sets up a few listeners on every view
 * instance and manages interactions between cells.
 *
 * @param  {Object}   view
 * @param  {Node}     before
 * @return {Notebook}
 */
Notebook.prototype.appendView = function (view, before) {
  if (view instanceof EditorView) {
    this.listenTo(view, 'navigateUp', function (view) {
      var prevView = this.getPrevView(view);
      if (prevView) { prevView.focus().moveCursorToEnd(); }
    });

    this.listenTo(view, 'navigateDown', function (view) {
      var nextView = this.getNextView(view);
      if (nextView) { nextView.focus().moveCursorToEnd(0); }
    });

    this.listenTo(view, 'moveUp', function (view) {
      if (!view.el.previousSibling) { return; }

      view.el.parentNode.insertBefore(view.el, view.el.previousSibling);
      view.focus();
      this.collection.sort();
      this.refreshFromView(view);
    });

    this.listenTo(view, 'moveDown', function (view) {
      if (!view.el.nextSibling) { return; }

      insertAfter(view.el, view.el.nextSibling);
      view.focus();
      this.collection.sort();
      this.refreshFromView(this.getPrevView(view));
    });

    // Listen to clone events and append the new views after the current view
    this.listenTo(view, 'clone', function (view, clone) {
      this.appendView(clone, view.el);
      // Need to work around the editor being removed and added with text cells
      var cursor = view.editor && view.editor.getCursor();
      clone.focus().editor.setCursor(cursor);
      this.refreshFromView(clone);
    });

    this.listenTo(view, 'remove', function (view) {
      // If it's the last node in the document, append a new code cell
      if (this.el.childNodes.length < 2) { this.appendCodeView(view.el); }
      // Focus in on the next/previous cell
      var newView = this.getNextView(view) || this.getPrevView(view);
      if (newView) { newView.focus().moveCursorToEnd(); }
      // Need to remove the model from the collection
      this.collection.remove(view.model);
      this.refreshFromView(newView);
    });

    // Listen for switch events, which isn't a real switch but recreates the
    // view using the data it has available. This results in some issues, but
    // avoids a whole different set of issues that would arrise trying to change
    // everything on the fly.
    this.listenTo(view, 'switch', function (view) {
      var newView;
      if (view instanceof TextView) {
        newView = this.appendCodeView(view.el, view.getValue());
      } else {
        newView = this.appendTextView(view.el, view.getValue());
      }

      var cursor = view.editor && view.editor.getCursor();
      view.remove();
      newView.focus();
      if (cursor) { newView.editor.setCursor(cursor); }
    });
  }

  /**
   * Event listener for 'appendNew' event.
   * Appends a new CodeCell after the passed in CellView.
   */
  this.listenTo(view, 'appendNew', function (view) {
    this.appendCodeView(view.el).focus();
    this.refreshFromView(view);
  });

  /**
   * Event listener for 'showControls' event.
   * Appends the UIControls to the focused cell.
   */
  this.listenTo(view, 'showControls', function (view) {
    this.controls.toggleView(view);
  });

  // Listening to different events for `text` cells
  if (view instanceof TextView) {
    // Listen to a code event which tells us to make a new code cell
    this.listenTo(view, 'code', function (view, code) {
      // Either add a new code view (if we have code or it's the last view),
      // or focus the next view.
      if (code || this.el.lastChild === view.el) {
        this.appendCodeView(view.el, code);
      }

      this.getNextView(view).moveCursorToEnd(0).focus();

      if (!view.getValue()) { view.remove(); }
    });

    // Append a new code cell when we blur a text cell and it the last cell.
    this.listenTo(view, 'blur', function (view) {
      if (this.el.lastChild === view.el) {
        this.appendCodeView().focus();
      }
    });
  }

  // Listening to another set of events for `code` cells
  if (view instanceof CodeView) {
    // Listen to execution events from the child views, which may or may not
    // require new working cells to be appended to the notebook.
    this.listenTo(view, 'execute', function (view) {
      // Refresh all completion data when a cell is executed.
      this.updateCompletion();

      // Need a flag here so we don't cause an infinite loop when executing the
      // notebook contents. (E.g. Hitting the last cell and adding a new cell).
      if (this._execution) { return; }

      if (this.el.lastChild === view.el) {
        this.appendCodeView().focus();
      } else {
        this.getNextView(view).moveCursorToEnd().focus();
      }
    });

    this.listenTo(view, 'text', function (view, text) {
      this.appendTextView(view.el, text).focus();

      if (!view.getValue()) { view.remove(); }
    });

    this.listenTo(view, 'browseUp', function (view, currentCid) {
      var model = this.collection.getPrevCode(this.collection.get(currentCid));

      if (model) {
        view.browseToCell(model);
        view.moveCursorToEnd();
      }
    });

    this.listenTo(view, 'browseDown', function (view, currentCid) {
      var model = this.collection.getNextCode(this.collection.get(currentCid));

      if (model) {
        view.browseToCell(model);
        view.moveCursorToEnd(0);
      }
    });

    this.listenTo(view, 'linesChanged', this.refreshFromView);
  }

  view.notebook = this;
  this.collection.push(view.model);

  // Append the view to the end of the console
  view.render().appendTo(_.bind(function (el) {
    return before ? insertAfter(el, before) : this.el.appendChild(el);
  }, this));

  // Sort the collection every time a node is added in a different position to
  // just being appended at the end
  if (before) { this.collection.sort(); }

  return this;
};
