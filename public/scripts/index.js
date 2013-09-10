// Bootstrap any required functionality before launching the application
require('./bootstrap');

// Alias the main app to the window for testing
var App = window.App = require('./views/app');

App._          = require('underscore');
App.Backbone   = require('backbone');

App.state      = require('./state/state');
App.messages   = require('./state/messages');
App.middleware = require('./state/middleware');

App.Sandbox     = require('./lib/sandbox');
App.PostMessage = require('./lib/post-message');

App.CodeMirror = {
  Editor:     CodeMirror, // Programatically create editors in tests
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
  TextEntry: require('./models/text-cell'),
  Gist:      require('./models/gist'),
  Session:   require('./models/session')
};

App.Collection = {
  Notebook: require('./collections/notebook')
};

// Attach core plugins
require('./plugins/core/completion')(App.middleware);
require('./plugins/core/result-cell')(App.middleware);
