var _        = require('underscore');
var trim     = require('trim');
var View     = require('./view');
var Backbone = require('backbone');

var CodeView           = require('./cells/code');
var TextView           = require('./cells/text');
var EditorView         = require('./cells/editor');
var EntryModel         = require('../models/entry');
var CellControls       = require('./cells/cell-controls');
var GistModel          = require('../models/gist');
var NotebookCollection = require('../collections/notebook');

var Sandbox     = require('../lib/sandbox');
var insertAfter = require('../lib/insert-after');

var Notebook = module.exports = View.extend({
  className: 'notebook'
});

var saveGist = _.debounce(function () {
  if (!this.user.id || !this.isOwner()) { return; }

  var gist = this.collection.serializeForGist();

  if (!trim.right(gist)) { return; }
  this.gist.setNotebook(gist);
  this.gist.save(null, { patch: true });
}, 500);

Notebook.prototype.initialize = function (options) {
  this.sandbox    = new Sandbox();
  this.controls   = new CellControls().render();
  this.collection = this.collection || new NotebookCollection();
  this._uniqueId  = 0;
  this.user       = options.user;
  // Every notebook has a unique gist and collection
  this.gist       = options.gist;
  this.collection = this.gist.notebook;

  this.listenToOnce(this.gist, 'sync', function (model) {
    Backbone.history.navigate(model.id);
  });

  // If the user changes at any point in the applications state, we may now
  // be granted the ability to edit, fork.. or we may have lost the ability
  this.listenTo(this.user,       'changeUser',         this.updateUser);
  this.listenTo(this.collection, 'remove sort change', this.save);
};

Notebook.prototype.remove = function () {
  this.sandbox.remove();
  return View.prototype.remove.call(this);
};

Notebook.prototype.fork = function (cb) {
  return this.gist.fork(cb);
};

Notebook.prototype.save = function () {
  if (!this.rendering) { saveGist.call(this); }
  return this;
};

Notebook.prototype.isOwner = function () {
  return this.gist.isOwner();
};

Notebook.prototype.updateUser = function () {
  this.collection.each(function (model) {
    model.view.renderEditor();
  });
  // If the user has changed, attempt to save the current notebook
  this.save();
};

Notebook.prototype.setContent = function (content) {
  var cells = this.collection.deserializeFromGist(content);

  // Empty all the current content to reset with new contents
  this.el.innerHTML = '';
  _.each(cells, function (cell) {
    var appendView = 'appendCodeView';
    if (cell.type === 'text') { appendView = 'appendTextView'; }
    this[appendView](null, cell.value);
  }, this);

  if (!this.el.childNodes.length) { this.appendCodeView(); }

  this.collection.last().view.focus();

  return this;
};

Notebook.prototype.render = function () {
  // Use a `rendering` flag to avoid resaving, etc. when rendering a gist
  this.rendering = true;
  this.el.classList.add('loading');
  View.prototype.render.call(this);

  var doneRendering = _.bind(function () {
    this.rendering = false;
    this.el.classList.remove('loading');
  }, this);

  // Reset the state
  if (this.gist.isNew()) {
    this.updateUser();
    this.setContent('');
    doneRendering();
    Backbone.history.navigate('');
    return this;
  }

  this.gist.fetch({
    success: _.bind(function () {
      this.updateUser();
      this.setContent(this.gist.getNotebook());
      doneRendering();
    }, this),

    // No gist exists or unauthorized, etc.
    error: _.bind(function () {
      doneRendering();
      Backbone.history.navigate('', { trigger: true });
    }, this)
  });

  return this;
};

Notebook.prototype.execute = function (cb) {
  var that = this;
  this.execution = true;

  // This chaining is a little awkward, but it allows the execution to work with
  // asynchronous callbacks
  (function execution (view) {
    // If no view is passed through, we must have hit the last view
    if (!view) {
      that.execution = false;
      return cb && cb();
    }

    view.focus().moveCursorToEnd();

    if (view.model.get('type') === 'code') {
      view.execute(function (err, result) {
        execution(that.getNextView(view));
      });
    } else {
      execution(that.getNextView(view));
    }
  })(this.collection.at(0).view);

  return this;
};

Notebook.prototype.getNextView = function (view) {
  var model = this.collection.getNext(view.model);
  return model && model.view;
};

Notebook.prototype.getPrevView = function (view) {
  var model = this.collection.getPrev(view.model);
  return model && model.view;
};

Notebook.prototype.refreshFromView = function (view) {
  do {
    view.refresh();
  } while (view = this.getNextView(view));

  return this;
};

Notebook.prototype.appendCodeView = function (el, value) {
  var view = new CodeView();
  this.appendView(view, el);
  view.setValue(value).moveCursorToEnd();
  return view;
};

Notebook.prototype.appendTextView = function (el, value) {
  var view = new TextView();
  this.appendView(view, el);
  view.setValue(value).moveCursorToEnd();
  return view;
};

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
    // require new working cells to be appended to the console
    this.listenTo(view, 'execute', function (view) {
      // Need a flag here so we don't cause an infinite loop when running the
      // notebook
      if (this.execution) { return; }

      if (this.el.lastChild === view.el) {
        this.appendCodeView().focus();
      } else {
        this.getNextView(view).moveCursorToEnd(0).focus();
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

  if (view.model.get('type') === 'code') {
    // Assign a unique index to every model for referencing upon execution
    view.model._uniqueCellId = this._uniqueId++;
  }

  // Some references may be needed
  view.notebook   = this;
  view.sandbox    = this.sandbox;
  view.model.view = view;
  // Add the model to the collection
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

Notebook.prototype.appendTo = function (el) {
  View.prototype.appendTo.call(this, el);

  // Any editor cells will need refreshing to display properly
  this.collection.each(function (model) {
    if (model.view.editor) { model.view.editor.refresh(); }
  });

  // Focus the final cell on appending, since focusing before its in the DOM
  // causes a few issues with phantom cursors.
  if (this.collection.last()) { this.collection.last().view.focus(); }

  return this;
};
