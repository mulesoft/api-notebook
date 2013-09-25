var bootstrap  = require('./bootstrap');
var loadScript = require('./lib/browser/load-script');

/**
 * The main application is aliased to the `window` for external access.
 *
 * @type {Function}
 */
var App = global.App = require('./views/app');

// Exposes internally used libraries globally to avoid unneeded requests in
// third-party middleware and plugins.
App.Library = {
  url:         require('url'),
  path:        require('path'),
  querystring: require('querystring'),
  async:       require('async'),
  Backbone:    require('backbone')
};

App._        = App.Library._ = require('underscore');
App.nextTick = process.nextTick;

// Exposes configuration details globally
App.state       = require('./state/state');
App.config      = require('./state/config');
App.router      = require('./state/router');
App.messages    = require('./state/messages');
App.middleware  = require('./state/middleware');
App.persistence = require('./state/persistence');
App.Sandbox     = require('./lib/sandbox');
App.PostMessage = require('./lib/post-message');

// Exposes CodeMirror to the world with our custom mods.
App.CodeMirror = {
  Editor:     CodeMirror, // Programatically create an editor in tests
  Completion: require('./lib/completion')
};

// Expose all application views
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

// Expose application models.
App.Model = {
  Entry:     require('./models/cell'),
  CodeEntry: require('./models/code-cell'),
  TextEntry: require('./models/text-cell')
};

// Expose application collections.
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
var prepareState = function (config, done) {
  if (global === global.parent) {
    return done(null, config);
  }

  var postMessage = new App.PostMessage(global.parent);

  // A config object can be passed from the parent frame with configuration
  // options.
  postMessage.on('config', function (data) {
    App._.extend(config, data);
  });

  // Allow running code in the context of this window by passing it through as a
  // string.
  postMessage.on('exec', function (evil) {
    /* jshint evil: true */
    postMessage.trigger('exec', global.eval(evil));
  });

  // Listen to any resize triggers from the messages object and send the parent
  // frame our updated iframe size.
  App.state.on('change:window.scrollHeight', function (_, height) {
    postMessage.trigger('height', height);
  });

  // The parent frame will send back a ready response when setup is complete.
  postMessage.on('ready', function () {
    done(null, config, postMessage);
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
 * @param {Function|Element} el
 * @param {Object}           config
 * @param {Function}         done
 */
App.start = function (el /*, config */, done) {
  var config = {};

  if (typeof done === 'object') {
    config = arguments[1];
    done   = arguments[2];
  }

  return prepareState(config, function (err, config, postMessage) {
    // Load all the injected scripts before starting the app.
    App.Library.async.each(config.inject || [], function (script, cb) {
      return loadScript(script, cb);
    }, function (err) {
      var app = new App().render().appendTo(el);

      // Set the config object after the app is started since it interacts with
      // different parts of the application.
      App.config.set(config);

      // Allows different parts of the application to kickstart requests.
      App.messages.trigger('ready');
      if (postMessage) { postMessage.trigger('rendered'); }

      // Passes the app instance to the callback function.
      return done && done(err, app);
    });
  });
};

// Extend the application with core middleware functionality.
require('./plugins/core')(App.middleware);
