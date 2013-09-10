var _        = require('underscore');
var fs       = require('fs');
var Backbone = require('backbone');
var domify   = require('domify');

var View     = require('./view');
var Notebook = require('./notebook');
var controls = require('../lib/controls');

var state    = require('../state/state');
var messages = require('../state/messages');

var App = module.exports = View.extend({
  className: 'application'
});

App.prototype.events = {
  'click .modal-toggle':   'toggleShortcuts',
  'click .modal-backdrop': 'hideShortcuts',
  'click .notebook-exec':  'runNotebook',
  'click .notebook-fork':  'forkNotebook',
  'click .notebook-auth':  'authNotebook'
};

App.prototype.initialize = function (options) {
  this.router = new (Backbone.Router.extend({
    routes: {
      '':    'newNotebook',
      ':id': 'loadNotebook'
    },
    newNotebook: _.bind(function (id) {
      this.setGist(new App.Model.Gist({}, { user: this.user }));
    }, this),
    loadNotebook: _.bind(function (id) {
      this.setGist(new App.Model.Gist({ id: id }, { user: this.user }));
    }, this)
  }))();

  Backbone.history.start({
    root:      '/',
    pushState: true,
    silent:    true
  });

  this.listenTo(messages, 'keydown:Shift-/', function () {
    this.toggleShortcuts();
  }, this);

  this.listenTo(messages, 'keydown:Esc', function () {
    this.hideShortcuts();
  }, this);

  this.user = new App.Model.Session();
  this.user.fetch();

  this.listenTo(this.user, 'changeUser', this.updateUser);

  this.setupEmbeddableWidget();
};

App.prototype.remove = function () {
  Backbone.history.stop();
  View.prototype.remove.call(this);
};

App.prototype.updateUser = function () {
  var isNew   = this.user.isNew();
  var isOwner = this.notebook.isOwner();

  this.el.classList[isOwner  ? 'add' : 'remove']('user-is-owner');
  this.el.classList[!isOwner ? 'add' : 'remove']('user-not-owner');
  this.el.classList[isNew    ? 'add' : 'remove']('user-not-authenticated');
  this.el.classList[!isNew   ? 'add' : 'remove']('user-is-authenticated');

  // Adding and removing some of these classes cause the container to resize.
  messages.trigger('resize');
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

App.prototype.setGist = function (gist) {
  // Remove any old notebook that might be hanging around
  if (this.notebook) {
    this.notebook.remove();
    this.stopListening(this.notebook.gist);
  }

  this.notebook = new App.View.Notebook({
    gist: gist,
    user: this.user
  });

  this.updateUser();
  this.notebook.render().appendTo(this.el);
  this.listenTo(gist, 'sync', this.updateUser);

  return this;
};

App.prototype.setDefaultContent = function (content) {
  this.router.off('route:newNotebook', this._prevNewNotebook);

  if (this.notebook.gist.isNew()) {
    this.notebook.setContent(content);
  }

  this.router.on('route:newNotebook', this._prevNewNotebook = function () {
    this.notebook.setContent(content);
  }, this);
};

App.prototype.setupEmbeddableWidget = function () {
  if (!global.parent || global === global.parent) { return this; }

  var doc         = global.document;
  var base        = doc.getElementsByTagName('base')[0];
  var postMessage = new App.PostMessage(global.parent);

  // Set the base url for opening links from the iframe in the parent frame.
  postMessage.on('referrer', function (href) {
    if (base) { base.parentNode.removeChild(base); }

    base = doc.createElement('base');
    base.setAttribute('href', href);
    base.setAttribute('target', '_parent');
    (doc.head || doc.getElementsByTagName('head')[0]).appendChild(base);
  });

  // Allow passing on default content to the application. This will set the
  // markdown content to use in the case that there is no gist id or loading
  // the gist id fails.
  postMessage.on('content', function (content) {
    this.setDefaultContent(content);
  }, this);

  // Allow passing of variables between the parent window and child frame.
  postMessage.on('alias', function (key, value) {
    global[key] = value;
  });

  // Allow grabbing a variable from the iframe and passing back to the parent.
  postMessage.on('export', function (key) {
    postMessage.trigger('export', key, global[key]);
  });

  // Send a message to the parent frame and let it know we are ready to accept
  // messages and data.
  postMessage.trigger('ready');

  // Listen to any resize triggers from the messages object and send the parent
  // frame our updated iframe size.
  this.listenTo(state, 'change:window.scrollHeight', function (_, height) {
    postMessage.trigger('height', height);
  });
};

App.prototype.render = function () {
  View.prototype.render.call(this);

  this.el.appendChild(domify(
    '<header class="notebook-header clearfix">' +
      '<div class="notebook-header-primary">' +
        '<h1>JSNotebook</h1>' +
      '</div>' +

      '<div class="notebook-header-secondary">' +
        '<button class="btn-text notebook-fork">Make my own copy</button>' +
        '<button class="btn-text notebook-auth">' +
          'Authenticate using Github' +
        '</button>' +
        '<button class="notebook-exec">Run All</button>' +
        '<button class="ir modal-toggle">Keyboard Shortcuts</button>' +
      '</div>' +
    '</header>' +

    '<div class="banner notebook-auth">' +
      '<p>Please sign in with Github to save the notebook.</p>' +
    '</div>' +

    '<div class="modal-backdrop"></div>'
  ));

  var allControls = controls.editor.concat(controls.code).concat(controls.text);

  var controlMap = _.map(allControls, function (control) {
    return '<tr>' +
      '<td>' + (control.keyCode || control.shortcut) + '</td>' +
      '<td>' + control.description + '</td>' +
    '</tr>';
  });

  this.el.appendChild(domify(
    '<div class="modal">' +
      '<header class="modal-header">' +
        '<h3>Keyboard Shortcuts</h3>' +
      '</header>' +

      '<div class="modal-body">' +
        '<table>' +
          '<colgroup>' +
            '<col class="col-mini">' +
            '<col class="col-large">' +
          '</colgroup>' +
          '<tr>' +
            '<th>Key Combination</th>' +
            '<th>Action</th>' +
          '</tr>' +
          controlMap.join('') +
        '</table>' +
      '</div>' +
    '</div>'
  ));

  return this;
};

App.prototype.appendTo = function () {
  View.prototype.appendTo.apply(this, arguments);
  Backbone.history.loadUrl();

  messages.trigger('resize');
};

App.prototype.runNotebook = function () {
  this.notebook.execute();
  return this;
};

App.prototype.authNotebook = function () {
  // Assign a global variable since it's the only way for the popup to access
  // back to this scope
  window.authenticate = _.bind(function (err, user) {
    this.user.save(user);
    // Clean up after itself
    delete window.authenticate;
  }, this);

  var width  = 500;
  var height = 350;
  var left   = (window.screen.availWidth - width) / 2;

  window.open(
    process.env.NOTEBOOK_URL + '/auth/github', '',
    'left=' + left + ',top=100,width=' + width + ',height=' + height
  );
};

App.prototype.forkNotebook = function () {
  this.notebook.fork(_.bind(function (err, newGist) {
    this.setGist(newGist);
  }, this));
  return this;
};
