var _ = require('underscore');

var View       = require('./view');
var CodeView   = require('./code-cell');
var TextView   = require('./text-cell');
var EditorView = require('./editor-cell');

var Cells       = require('../collections/cells');
var Sandbox     = require('../lib/sandbox');
var config      = require('../state/config');
var messages    = require('../state/messages');
var middleware  = require('../state/middleware');
var insertAfter = require('../lib/browser/insert-after');

var completionMiddleware = require('../lib/sandbox-completion');

/**
 * Generates a generic function for appending new view instances.
 *
 * @param  {Backbone.View} View
 * @return {Function}
 */
var appendNewView = function (View) {
  return function (el, value) {
    var view = new View({ notebook: this });

    // Set a default value on the view, if specified.
    if (value) {
      view.setValue(value);
    }

    // Append the view to the notebook.
    this.appendView(view, el);

    // Trigger a message to listen to, when we aren't rendering a notebook.
    if (!this._rendering) {
      messages.trigger('cell:new', view);
    }

    return view;
  };
};

/**
 * Generates a generic function for prepending new views.
 *
 * @param  {Backbone.View} View
 * @return {Function}
 */
var prependNewView = function (View) {
  return function (el, value) {
    return appendNewView(View).call(this, function (viewEl) {
      el.parentNode.insertBefore(viewEl, el);
    }, value);
  };
};

/**
 * Create a new notebook instance.
 *
 * @type {Function}
 */
var Notebook = module.exports = View.extend({
  className: 'notebook-view'
});

 /**
 * Initialize the notebook view.
 */
Notebook.prototype.initialize = function () {
  this.collection = new Cells();

  return View.prototype.initialize.apply(this, arguments);
};

/**
 * Removes the notebook from the DOM.
 *
 * @return {Notebook}
 */
Notebook.prototype.remove = function () {
  // Remove lingering notebook views.
  if (this.sandbox) {
    this.sandbox.remove();
    delete this.sandbox;
  }

  // Remove notebook view specific middleware.
  middleware.deregister(this._middleware);
  delete this._middleware;

  return View.prototype.remove.call(this);
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
  View.prototype.render.call(this);

  // Create a new sandbox instance for every notebook view.
  this.sandbox = new Sandbox();

  // The completion options object is shared between all cells and used for
  // completion. Make sure we set this connection up before rendering any cells.
  this.completionOptions = {
    window: this.sandbox.window
  };

  // Register a middleware hook for augmenting the sandbox context.
  this._middleware = {
    'sandbox:context': _.bind(function (context, next) {
      var active   = this.activeView;
      var prevCode = active && this.collection.getPrevCode(active.model);

      // Assign the previous cell value.
      if (prevCode) {
        context.$_ = prevCode.get('result');
      }

      // Assign numeric cell values.
      _.each(this.collection.filter(function (model) {
        return model.get('type') === 'code';
      }), function (model, index) {
        context['$' + index] = model.get('result');
      });

      return next();
    }, this)
  };

  _.extend(this._middleware, completionMiddleware(this.sandbox.window));
  middleware.register(this._middleware);

  // Set a rendering flag while we are rendering the initial collection.
  this._rendering = true;

  // Iterate over the notebook cells and add to the view.
  _.each(this.model.get('cells'), function (cell) {
    var appendView = 'appendCodeView';

    if (cell.type === 'text') {
      appendView = 'appendTextView';
    }

    this[appendView](null, cell.value);
  }, this);

  // If no cells were appended, manually append a starting code view.
  if (!this.collection.length) {
    this.appendCodeView();
  }

  // Remove the rendering flag once the initial view has been set up.
  delete this._rendering;

  this.listenTo(this.collection, 'remove sort', this.updateCompletion);

  this.listenTo(this.collection, 'change remove sort', function () {
    this.model.set('cells', this.collection.toJSON());
  });

  this.updateCompletion();

  return this;
};

/**
 * Execute the entire notebook sequentially.
 *
 * @param {Function} done
 */
Notebook.prototype.execute = function (done) {
  if (this._executing) {
    return done && done(new Error('Already executing notebook'));
  }

  var that = this;
  this._executing = true;

  // This chaining is a little awkward, but it allows the execution to work with
  // asynchronous callbacks.
  (function execution (view) {
    // If no view is passed through, we must have hit the last view.
    if (!view) {
      that._executing = false;
      return done && done();
    }

    // Only execute code cells, skips other cell types.
    if (view.model.get('type') === 'code') {
      view.execute(function () {
        execution(that.getNextView(view));
      });
    } else {
      execution(that.getNextView(view));
    }
  })(this.collection.at(0).view);
};

/**
 * Execute notebook cells sequentially until a certain view.
 *
 * @param {Backbone.View} current
 * @param {Function}      done
 */
Notebook.prototype.executePrevious = function (current, done) {
  var that = this;

  // Don't need to executePrevious if we're already in a full execution.
  if (this._executing) {
    return done && done();
  }

  this._executing = true;

  (function execution (view) {
    // If no view is passed through, we must have hit the last view.
    if (!view || current === view) {
      that._executing = false;
      return done && done();
    }

    // Only execute code cells, skips other cell types.
    if (view.model.get('type') === 'code' && !view.data.get('executed')) {
      view.execute(function () {
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
 * Append and prepend new cell view instances.
 */
Notebook.prototype.appendCodeView  = appendNewView(CodeView);
Notebook.prototype.appendTextView  = appendNewView(TextView);
Notebook.prototype.prependCodeView = prependNewView(CodeView);
Notebook.prototype.prependTextView = prependNewView(TextView);

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
    this.listenTo(view, 'moveUp', function (view) {
      if (!view.el.previousSibling) { return; }

      view.el.parentNode.insertBefore(view.el, view.el.previousSibling);
      this.collection.sort();
      view.update().focus();
    });

    this.listenTo(view, 'moveDown', function (view) {
      if (!view.el.nextSibling) { return; }

      insertAfter(view.el, view.el.nextSibling);
      view.focus();
      this.collection.sort();
      this.getPrevView(view).update();
    });

    this.listenTo(view, 'newTextAbove', function (view) {
      this.prependTextView(view.el).focus();
    });

    this.listenTo(view, 'newCodeAbove', function (view) {
      this.prependCodeView(view.el).focus();
    });

    this.listenTo(view, 'newTextBelow', function (view) {
      this.appendTextView(view.el).focus();
    });

    this.listenTo(view, 'newCodeBelow', function (view) {
      this.appendCodeView(view.el).focus();
    });

    // Listen to clone events and append the new views after the current view
    this.listenTo(view, 'clone', function (view, clone) {
      this.appendView(clone, view.el);
      // Need to work around the editor being removed and added with text cells
      var cursor = view.editor && view.editor.getCursor();
      clone.focus().editor.setCursor(cursor);
    });

    this.listenTo(view, 'remove', function (view) {
      var newView = this.getPrevView(view) || this.getNextView(view);

      this.collection.remove(view.model);
      messages.trigger('cell:remove', view);

      if (newView) {
        // Focus on the new cell instance.
        newView.update().focus().moveCursorToEnd();
      }
    });

    this.listenTo(view, 'delete', function () {
      // If it's the last cell in the document, append an empty code cell.
      if (this.collection.length < 2) {
        this.appendCodeView().refresh().focus();
      }
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

      view.delete();
      newView.focus();

      if (cursor) {
        newView.editor.setCursor(cursor);
      }
    });

    this.listenTo(view, 'browseUp', function (view) {
      var prevView = this.getPrevView(view);

      if (prevView) {
        prevView.focus().editor.setCursor({
          line: prevView.editor.lastLine(),
          ch:   view.editor.getCursor().ch
        });
      }
    });

    this.listenTo(view, 'browseDown', function (view) {
      var nextView = this.getNextView(view);

      if (nextView) {
        nextView.focus().editor.setCursor({
          line: 0,
          ch:   view.editor.getCursor().ch
        });
      }
    });

    this.listenTo(view, 'focus executing', function (view) {
      // Avoid updating when the view hasn't changed.
      if (this.activeView === view) {
        return;
      }

      // Update the active view and trigger the completion context update.
      this.activeView = view;
      this.updateCompletion();
    });
  }

  // Listening to different events for `text` cells.
  if (view instanceof TextView) {
    this.listenTo(view, 'blur', function (view) {
      if (this.el.lastChild === view.el) {
        this.appendCodeView().refresh().focus();
      }
    });
  }

  // Listening to another set of events for `code` cells.
  if (view instanceof CodeView) {
    // Listen to execution events from the child views, which may or may not
    // require new working cells to be appended to the notebook.
    this.listenTo(view, 'execute', function (view) {
      // Refresh all completion data when a cell is executed.
      this.updateCompletion();

      // Need a flag here so we don't cause an infinite loop when executing the
      // notebook contents. (E.g. Hitting the last cell and adding a new cell).
      if (this._executing || config.get('embedded')) { return; }

      if (this.el.lastChild === view.el) {
        this.appendCodeView().focus();
      } else {
        this.getNextView(view).focus().moveCursorToEnd();
      }
    });
  }

  this.collection.push(view.model);

  // Append the view to the end of the notebook.
  view.render().appendTo(_.bind(function (el) {
    if (_.isFunction(before)) {
      return before(el);
    }

    return before ? insertAfter(el, before) : this.el.appendChild(el);
  }, this));

  // Sort the collection every time a node is added in a different position to
  // just being appended at the end.
  if (before) { this.collection.sort(); }

  // Update line numbers and refresh the view.
  view.update().refresh();

  return this;
};
