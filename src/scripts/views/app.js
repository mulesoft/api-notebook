var _        = require('underscore');
var DOMBars  = require('../lib/dombars');
var Backbone = require('backbone');

var View         = require('./template');
var Sidebar      = require('./sidebar');
var Notebook     = require('./notebook');
var EditNotebook = require('./edit-notebook');
var bounce       = require('../lib/bounce');
var controls     = require('../lib/controls');
var state        = require('../state/state');
var config       = require('../state/config');
var messages     = require('../state/messages');
var middleware   = require('../state/middleware');
var persistence  = require('../state/persistence');
var domListen    = require('../lib/dom-listen');
var notifyError  = require('../lib/notify-error');

var ENTER_KEY    = 13;
var EMBED_SCRIPT = process.env.embed.script;

/**
 * Create a central application view.
 *
 * @type {Function}
 */
var App = module.exports = View.extend({
  className: 'application'
});

/**
 * Keep track of all events that can be triggered from the DOM.
 *
 * @type {Object}
 */
App.prototype.events = {
  // Block clicks on a disabled button.
  'click .toolbar-buttons button': 'blurAndCheckDisabled',
  'click .notebook-help':   'showShortcuts',
  'click .notebook-exec':   'runNotebook',
  'click .notebook-clone':  'cloneNotebook',
  'click .notebook-save':   'saveNotebook',
  'click .notebook-share':  'shareNotebook',
  'click .toggle-notebook': function (e) {
    this.blurAndCheckDisabled(e);
    this.toggleView();
  },
  'click .notebook-new':    'newNotebook',
  'keyup .notebook-title': function (e, el) {
    var meta = persistence.get('notebook').get('meta');

    // Update the title on keypress.
    meta[el.value ? 'set' : 'unset']('title', el.value);

    if (e.which === ENTER_KEY) {
      el.blur();
    }
  }
};

/**
 * Runs when a toolbar button is clicked and when toggle-notebook is clicked.
 * Checks that target button is not disabled to avoid the event's propagation and blurs to stop the outline.
 * @param e : MouseEvent
 * @returns {App}
 */
App.prototype.blurAndCheckDisabled = function (e) {
  var node = e.target;

  while (node.tagName !== 'BUTTON') {
    node = node.parentNode;
  }

  node.blur();
  if (node.classList.contains('btn-disabled')) {
    e.stopImmediatePropagation();
  }
  return this;
};

/**
 * Runs when we create an instance of the applications. Starts listening for
 * relevant events to respond to.
 */
App.prototype.initialize = function () {
  View.prototype.initialize.apply(this, arguments);

  var model;

  // Set a sidebar instance to render.
  this.data.set('sidebar', new Sidebar());

  /**
   * Block attempts to close the window when the persistence state is dirty.
   */
  this.listenTo(domListen(window), 'beforeunload', function (e) {
    if (!config.get('savable') || persistence.isCurrentSaved()) { return; }

    return (e || window.event).returnValue = 'Your changes will be lost.';
  });

  /**
   * Re-render the notebook when the notebook changes.
   */
  this.listenTo(persistence, 'changeNotebook', this.renderView);

  /**
   * Update user state data when the user changes.
   */
  this.listenTo(persistence, 'changeUser changeNotebook', bounce(function () {
    this.data.set('owner',         persistence.isCurrentOwner());
    this.data.set('authenticated', persistence.isAuthenticated());
  }, this));

  /**
   * Update the saved view state when the id changes.
   */
  this.listenTo(persistence, 'change:notebook', bounce(function () {
    if (model) {
      this.stopListening(model, 'change:id');
      this.stopListening(model.get('meta'), 'change:title');
    }

    // Update model reference.
    model = persistence.get('notebook');

    // Update the title when the current notebook updates.
    this.listenTo(model.get('meta'), 'change:title', bounce(function () {
      var title   = model.get('meta').get('title');
      var titleEl = this.el.querySelector('.notebook-title');

      // Update the title if it's out of sync.
      if (titleEl && document.activeElement !== titleEl) {
        titleEl.value = title || '';
      }

      document.title = title ? title + ' • Notebook' : 'Notebook';
    }, this));

    // Update the saved state when the id changes.
    this.listenTo(model, 'change:id', bounce(function () {
      this.data.set('saved', !persistence.isCurrentNew());
    }, this));
  }, this));

  /**
   * Update state variables when the persistence state changes.
   */
  this.listenTo(persistence, 'change:state', bounce(function () {
    var timestamp    = new Date().toLocaleTimeString();
    var isNew        = persistence.isCurrentNew();
    var currentState = persistence.get('state');
    var canSave      = config.get('savable');

    var states = {
      1: 'Saving',
      2: 'Loading',
      3: 'Save failed',
      4: isNew ? '' : 'Saved ' + timestamp,
      5: 'Load Failed',
      6: isNew ? '' : 'Loaded ' + timestamp,
      7: canSave ? 'Unsaved changes' : '', // Avoid displaying when impossible.
      8: 'Cloning notebook'
    };

    if (currentState === 5) {
      middleware.trigger('ui:notify', {
        title: 'Load failed!',
        message: 'Could not load the notebook'
      });
    }

    state.set('loading',       currentState === 2);
    this.data.set('stateText', states[currentState]);
  }, this));

  /**
   * Add or remove a footer class depending on visibility.
   */
  this.listenTo(config, 'change:header', bounce(function () {
    var has = config.get('header');
    this.el.classList[has ? 'add' : 'remove']('application-has-header');
  }, this));

  /**
   * Add or remove a footer class depending on visibility.
   */
  this.listenTo(config, 'change:footer', bounce(function () {
    var has = config.get('footer');
    this.el.classList[has ? 'add' : 'remove']('application-has-footer');
  }, this));

  return this;
};

/**
 * Precompile the appliction template.
 *
 * @type {Function}
 */
App.prototype.template = require('../../templates/views/app.hbs');

/**
 * Render the current view.
 */
App.prototype.renderView = function () {
  var method = this.isNotebook() ? 'showNotebook' : 'showEditor';

  return this[method]();
};

/**
 * Return whether we are currently using the notebook view.
 *
 * @return {Boolean}
 */
App.prototype.isNotebook = function () {
  return this.data.get('notebook') instanceof Notebook;
};

/**
 * Render the standard notebook view.
 */
App.prototype.showNotebook = function () {
  this.data.set('notebook', new Notebook({
    model: persistence.get('notebook')
  }));

  this.data.set('activeView', 'view');
  DOMBars.VM.exec(_.bind(messages.trigger, messages, 'refresh'));
};

/**
 * Render the notebook raw source editor.
 */
App.prototype.showEditor = function () {
  this.data.set('notebook', new EditNotebook({
    model: persistence.get('notebook')
  }));

  this.data.set('activeView', 'edit');
  DOMBars.VM.exec(_.bind(messages.trigger, messages, 'refresh'));
};

/**
 * Toggle the view between edit and notebook view.
 */
App.prototype.toggleView = function () {
  var method = this.isNotebook() ? 'showEditor' : 'showNotebook';

  return this[method]();
};

/**
 * Shows the shortcut modal.
 */
App.prototype.showShortcuts = function () {
  var allControls = controls.editor.concat(controls.code).concat(controls.text);

  middleware.trigger('ui:modal', {
    title: 'Keyboard Shortcuts',
    content: [
      '<table class="controls-table">' +
        '<colgroup>' +
          '<col class="controls-col-mini">' +
          '<col class="controls-col-large">' +
        '</colgroup>' +
        '<tr>' +
          '<th>Key Combination</th>' +
          '<th>Action</th>' +
        '</tr>' +
        _.map(allControls, function (control) {
          return [
            '<tr>',
            '<td>' + (control.keyCode || control.shortcut) + '</td>',
            '<td>' + control.description + '</td>',
            '</tr>'
          ].join('\n');
        }).join('\n') +
      '</table>'
    ].join('\n')
  });
};

/**
 * Append the application view to an element.
 *
 * @return {App}
 */
App.prototype.appendTo = function () {
  View.prototype.appendTo.apply(this, arguments);
  this.showNotebook();

  // When changing to embedded mode, ensure we are in notebook mode.
  this.listenTo(config, 'change:embedded', function () {
    if (config.get('embedded') && !this.isNotebook()) {
      this.showNotebook();
    }
  });

  return this;
};

/**
 * Runs the entire notebook sequentially.
 */
App.prototype.runNotebook = function () {

  messages.trigger('app:run');

  return this.data.get('notebook').execute();
};

/**
 * Clone the current notebook in-memory.
 */
App.prototype.cloneNotebook = function () {
  return persistence.clone(notifyError('Could not clone notebook'));
};

/**
 * Manually attempt to save the notebook.
 */
App.prototype.saveNotebook = function () {

  messages.trigger('app:save');

  return persistence.save(
    persistence.get('notebook'), notifyError('Could not save notebook')
  );
};

/**
 * Manually create a new notebook instance. Before we discard any current
 * changes, check with the user.
 */
App.prototype.newNotebook = function () {

  messages.trigger('app:new');

  var newNotebook = function (err, confirmed) {
    if (err || !confirmed) { return; }

    return persistence.new(notifyError('Could not create new notebook'));
  };

  // If the current notebook is already saved, immediately reload.
  if (persistence.isCurrentSaved()) {
    return newNotebook(null, true);
  }

  // Confirm with the user that this is the action they want to do.
  return middleware.trigger('ui:confirm', {
    title: 'You have unsaved changes. Abandon changes?',
    content: '<p>' +
      'Save your work by pressing \'Cancel\' and ' +
      'then clicking the save icon in the toolbar or using ' +
      'the keystroke CMD + S (or CTRL + S).' +
      '</p>' +
      '<p>' +
      'Press \'OK\' to abandon this notebook. ' +
      'Your changes will be lost.' +
      '</p>'
  }, newNotebook);
};

/**
 * Share the notebook inside a modal display.
 */
App.prototype.shareNotebook = function () {
  var id          = persistence.get('notebook').get('id');
  var shareScript = '<script src="' + EMBED_SCRIPT + '" data-notebook' +
    (id ? ' data-id="' + id + '"' : '') + '></script>';

  middleware.trigger('ui:modal', {
    title: 'Share Notebook',
    content: '<p class="notebook-share-about">Copy this code to embed.</p>' +
      '<div class="form-group">' +
      '<input class="notebook-share-input item-share" ' +
      'value="' + _.escape(shareScript) + '" readonly>' +
      '<p class="notebook-share-about">Copy this link to share.</p>' +
      '<input class="notebook-share-input item-share" ' +
      'value="' + config.get('url') + '" readonly>' +
      '</div>',
    show: function (modal) {
      Backbone.$(modal.el).on('click', '.notebook-share-input', function (e) {
        e.target.select();
      });
    }
  });
};
