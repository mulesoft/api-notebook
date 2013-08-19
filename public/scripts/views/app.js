var _        = require('underscore');
var Backbone = require('backbone');

var View     = require('./hbs');
var Notebook = require('./notebook');

// Alias `App` to `window` for testing purposes
var App = module.exports = View.extend({
  className: 'application',
  template: require('../../templates/application.hbs')
});

// Access a sandbox instance from tests
App.Sandbox = require('../lib/sandbox');

// Alias all the available views
App.View = {
  View:       require('./view'),
  Hbs:        require('./hbs'),
  Notebook:   require('./notebook'),
  Inspector:  require('./inspector'),
  Cell:       require('./cells/cell'),
  CodeCell:   require('./cells/code'),
  TextCell:   require('./cells/text'),
  EditorCell: require('./cells/editor'),
  ResultCell: require('./cells/result')
};

// Alias all the available models
App.Model = {
  Entry:     require('../models/entry'),
  CodeEntry: require('../models/code-entry'),
  TextEntry: require('../models/text-entry')
};

// Alias all the available collections
App.Collection = {
  Notebook: require('../collections/notebook')
};

App.prototype.events = {
  'click .modal-toggle':   'toggleShortcuts',
  'click .modal-backdrop': 'hideShortcuts'
};

App.prototype.initialize = function () {
  // Creates a new working notebook and appends it to the current application
  this.notebook = new App.View.Notebook({
    collection: new App.Collection.Notebook()
  });

  // Listen to keyboard presses
  this.listenTo(Backbone.$(document), 'keydown', _.bind(function (e) {
    var ESC           = 27;
    var QUESTION_MARK = 191;

    if (e.which === QUESTION_MARK && e.shiftKey) {
      return this.toggleShortcuts();
    }

    if (e.which === ESC) {
      return this.hideShortcuts();
    }
  }, this));
};

App.prototype.render = function () {
  View.prototype.render.call(this);
  this.notebook.render();
  return this;
};

App.prototype.showShortcuts = function () {
  this.el.classList.add('modal-visible');
};

App.prototype.hideShortcuts = function () {
  this.el.classList.remove('modal-visible');
};

App.prototype.toggleShortcuts = function () {
  if (this.el.classList.contains('modal-visible')) {
    this.hideShortcuts();
  } else {
    this.showShortcuts();
  }
};

App.prototype.appendTo = function () {
  View.prototype.appendTo.apply(this, arguments);
  this.notebook.appendTo(this.el);
};
