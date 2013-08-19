var _    = require('underscore');
var View = require('./view');

var CodeView           = require('./cells/code');
var TextView           = require('./cells/text');
var EditorView         = require('./cells/editor');
var EntryModel         = require('../models/entry');
var NotebookCollection = require('../collections/notebook');

var Sandbox     = require('../lib/sandbox');
var insertAfter = require('../lib/insert-after');

var Notebook = module.exports = View.extend({
  className: 'notebook'
});

Notebook.prototype.initialize = function () {
  this.sandbox    = new Sandbox();
  this.collection = this.collection || new NotebookCollection();
  this._uniqueId  = 0;
};

Notebook.prototype.remove = function () {
  this.sandbox.remove();
  View.prototype.remove.call(this);
};

Notebook.prototype.getNextView = function (view) {
  var model = this.collection.getNext(view.model);
  return model && model.view;
};

Notebook.prototype.getPrevView = function (view) {
  var model = this.collection.getPrev(view.model);
  return model && model.view;
};

Notebook.prototype.appendCodeView = function (el, value) {
  var view = new CodeView();
  this.appendView(view, el);
  view.setValue(value);
  return view;
};

Notebook.prototype.appendTextView = function (el, value) {
  var view = new TextView();
  this.appendView(view, el);
  view.setValue(value);
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
    });

    this.listenTo(view, 'moveDown', function (view) {
      if (!view.el.nextSibling) { return; }

      insertAfter(view.el, view.el.nextSibling);
      view.focus();
      this.collection.sort();
    });

    // Listen to clone events and append the new views after the current view
    this.listenTo(view, 'clone', function (view, clone) {
      this.appendView(clone, view.el);
      clone.editor.setCursor(view.editor.getCursor());
    });

    this.listenTo(view, 'remove', function (view) {
      // If it's the last node in the document, append a new code cell
      if (this.el.childNodes.length < 2) { this.appendCodeView(view.el); }
      // Focus in on the next/previous cell
      var newView = this.getNextView(view) || this.getPrevView(view);
      if (newView) { newView.focus().moveCursorToEnd(); }
      // Need to remove the model from the collection
      this.collection.remove(view.model);
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
      view.remove();
      newView.editor.setCursor(view.editor.getCursor());
    });
  }

  // Listening to different events for `text` cells
  if (view instanceof TextView) {
    // Listen to a code event which tells us to make a new code cell
    this.listenTo(view, 'code', function (view, code) {
      if (this.el.lastChild === view.el) {
        this.appendCodeView(view.el, code);
      } else {
        if (code) { this.appendCodeView(view.el, code); }
        this.getNextView(view).focus().moveCursorToEnd(0);
      }
      if (!view.getValue()) { view.remove(); }
    });
  }

  // Listening to another set of events for `code` cells
  if (view instanceof CodeView) {
    // Listen to execution events from the child views, which may or may not
    // require new working cells to be appended to the console
    this.listenTo(view, 'execute', function (view) {
      if (this.el.lastChild === view.el) {
        this.appendCodeView();
      } else {
        this.getNextView(view).focus().moveCursorToEnd(0);
      }
    });

    this.listenTo(view, 'text', function (view, text) {
      this.appendTextView(view.el, text);
      if (!view.getValue()) { view.remove(); }
    });

    this.listenTo(view, 'browseUp', function (view, currentCid) {
      var model = this.collection.get(currentCid);

      while (model = this.collection.getPrev(model)) {
        if (model.get('type') === 'code') {
          view.browseToCell(model);
          view.moveCursorToEnd();
          break;
        }
      }
    });

    this.listenTo(view, 'browseDown', function (view, currentCid) {
      var model = this.collection.get(currentCid);

      while (model = this.collection.getNext(model)) {
        if (model.get('type') === 'code') {
          view.browseToCell(model);
          view.moveCursorToEnd(0);
          break;
        }
      }
    });
  }

  if (view.model.get('type') === 'code') {
    // Assign a unique index to every model for referencing upon execution
    view.model._uniqueCellId = this._uniqueId++;
  }

  // Append the view to the end of the console
  view.render().appendTo(_.bind(function (el) {
    return before ? insertAfter(el, before) : this.el.appendChild(el);
  }, this));
  // Some references may be needed
  view.sandbox    = this.sandbox;
  view.model.view = view;
  // Add the model to the collection
  this.collection.push(view.model);
  // Sort the collection every time a node is added in a different position to
  // just being appended at the end
  if (before) { this.collection.sort(); }

  return this;
};

Notebook.prototype.appendTo = function (el) {
  View.prototype.appendTo.call(this, el);
  // Append an initial starting view
  this.appendCodeView();
  return this;
};
