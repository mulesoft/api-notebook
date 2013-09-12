// Bootstrap any required functionality before launching the application
require('./bootstrap');

// Alias the main app to the window for testing
var App = window.App = require('./views/app');

App._          = require('underscore');
App.Backbone   = require('backbone');

App.state       = require('./state/state');
App.config      = require('./state/config');
App.router      = require('./state/router');
App.messages    = require('./state/messages');
App.middleware  = require('./state/middleware');
App.persistence = require('./state/persistence');

App.Sandbox     = require('./lib/sandbox');
App.PostMessage = require('./lib/post-message');

App.CodeMirror = {
  Editor:     CodeMirror, // Programatically create an editor in tests
  Completion: require('./lib/completion')
};

App.View = {
  View:           require('./views/view'),
  Notebook:       require('./views/notebook'),
  Inspector:      require('./views/inspector'),
  ErrorInspector: require('./views/error-inspector'),
  Cell:           require('./views/cell'),
  CodeCell:       require('./views/code-cell'),
  TextCell:       require('./views/text-cell'),
  EditorCell:     require('./views/editor-cell'),
  ResultCell:     require('./views/result-cell'),
  CellControls:   require('./views/cell-controls'),
};

App.Model = {
  Entry:     require('./models/cell'),
  CodeEntry: require('./models/code-cell'),
  TextEntry: require('./models/text-cell')
};

App.Collection = {
  Notebook: require('./collections/notebook')
};

/**
 * Set up the initial application state. This could be synchronous (accessing
 * the page directly) or asynchronous (embeddable widget).
 *
 * @param {Object}   config
 * @param {Function} done
 */
var prepareState = function (done) {
  if (global === global.parent) {
    return done();
  }

  var config      = {};
  var postMessage = new App.PostMessage(global.parent);

  // A config object can be passed from the parent frame with configuration
  // options.
  postMessage.on('config', function (data) {
    App._.extend(config, data);
  });

  // Allow grabbing a variable from the iframe and passing back to the parent.
  postMessage.on('export', function (key) {
    postMessage.trigger('export', key, global[key]);
  });

  // Listen to any resize triggers from the messages object and send the parent
  // frame our updated iframe size.
  App.state.on('change:window.scrollHeight', function (_, height) {
    postMessage.trigger('height', height);
  });

  // The parent frame will send back a ready response when setup is complete.
  postMessage.on('ready', function () {
    done(null, config);
  });

  // Send a message to the parent frame and let it know we are ready to accept
  // messages and data.
  postMessage.trigger('ready');
};

/**
 * Define a custom start method so that the application can bind middleware and
 * prepare state before we actually append the notebook which relies on some of
 * the middleware being available.
 *
 * @param  {Function|Element} el
 */
App.start = function (el /*, config */, done) {
  var config = {};

  if (typeof done === 'object') {
    config = arguments[1];
    done   = arguments[2];
  }

  return prepareState(function (err, data) {
    var app = new App().render().appendTo(el);
    // Extends the passed in config with data received from the parent frame and
    // initializes the starting application config.
    App.config.set(App._.extend({}, config, data));
    // Allows different parts of the application to kickstart requests.
    App.messages.trigger('ready');
    // Passes the app instance to the callback function.
    if (done) { done(err, app); }
  });
};

// Attach core middleware modules.
require('./plugins/core/ajax')(App.middleware);
require('./plugins/core/completion')(App.middleware);
require('./plugins/core/result-cell')(App.middleware);
require('./plugins/core/persistence')(App.middleware);
require('./plugins/core/authentication')(App.middleware);
