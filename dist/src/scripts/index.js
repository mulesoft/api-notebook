require('./bootstrap');

/**
 * The main application is aliased to the `window` for external access.
 *
 * @type {Function}
 */
var App = module.exports = window.App = {};

App.Library = {
  qs:         require('querystring'),
  url:        require('url'),
  async:      require('async'),
  domify:     require('domify'),
  marked:     require('marked'),
  Backbone:   require('backbone'),
  DOMBars:    require('./lib/dombars'),
  changeCase: require('change-case')
};

App._        = App.Library._ = require('underscore');
App.nextTick = process.nextTick;

// Exposes configuration details globally
App.state       = require('./state/state');
App.store       = require('./state/store');
App.config      = require('./state/config');
App.messages    = require('./state/messages');
App.middleware  = require('./state/middleware');
App.persistence = require('./state/persistence');
App.Sandbox     = require('./lib/sandbox');
App.PostMessage = require('./lib/post-message');


// Exposes CodeMirror to the world with our custom mods.
App.CodeMirror = {
  Editor:            require('codemirror'),
  Completion:        require('./lib/completion'),
  sandboxCompletion: require('./lib/sandbox-completion')
};

// Expose all application views.
App.View = {
  App:            require('./views/app'),
  View:           require('./views/view'),
  Notebook:       require('./views/notebook'),
  EditNotebook:   require('./views/edit-notebook'),
  Inspector:      require('./views/inspector'),
  ErrorInspector: require('./views/error-inspector'),
  CodeCell:       require('./views/code-cell'),
  TextCell:       require('./views/text-cell'),
  EditorCell:     require('./views/editor-cell'),
  ResultCell:     require('./views/result-cell'),
  CellButtons:    require('./views/cell-buttons'),
  CellControls:   require('./views/cell-controls')
};

// Expose application models.
App.Model = {
  Cell:     require('./models/cell'),
  Meta:     require('./models/meta'),
  Notebook: require('./models/notebook')
};

// Expose application collections.
App.Collection = {
  Cells: require('./collections/cells')
};

/**
 * Define a custom start method so that the application can bind middleware and
 * prepare state before we actually append the notebook which relies on some of
 * the middleware being available.
 *
 * @param {Function|Element} el
 * @param {Object}           [config]
 * @param {Function}         done
 */
App.start = function (el /*, options */, done) {
  var options = {};

  if (typeof done === 'object') {
    options = arguments[1];
    done    = arguments[2];
  }

  /**
   * Complete application start up.
   *
   * @param {Error} err
   */
  var complete = function (err) {
    if (err) {
      console.error(err);
    }

    return done && done(err);
  };

  return App.middleware.trigger('application:start', options, function (err) {
    if (err) {
      return complete(err);
    }

    var app = new App.View.App().render().appendTo(el);

    // Send a `rendered` event back to the parent frame when we are embedded.
    if (App.postMessage) {
      App.postMessage.trigger('rendered');
    }

    return App.middleware.trigger('application:ready', app, complete);
  });
};
