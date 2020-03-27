var _           = require('underscore');
var View        = require('./template');
var bounce      = require('../lib/bounce');
var config      = require('../state/config');
var middleware  = require('../state/middleware');
var persistence = require('../state/persistence');
var notifyError = require('../lib/notify-error');

/**
 * Create a new sidebar view class.
 *
 * @type {Function}
 */
var SidebarView = module.exports = View.extend({
  className: 'notebook-sidebar'
});

/**
 * Initialize the sidebar view.
 */
SidebarView.prototype.initialize = function () {
  View.prototype.initialize.apply(this, arguments);

  /**
   * Check whether the current notebook has been saved.
   */
  this.listenTo(persistence, 'change:state', bounce(function () {
    this.data.set('saved', persistence.isCurrentSaved());
  }, this));
};

/**
 * An object of all events that trigger on the sidebar view.
 *
 * @type {Object}
 */
SidebarView.prototype.events = {
  'click [data-delete]': function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    this.deleteId(e.target.getAttribute('data-delete'));
  },
  'click [data-load]': function (e, target) {
    var id = target.getAttribute('data-load');

    // If the current notebook has not been saved yet, prompt the user.
    if (!persistence.isCurrentSaved()) {
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
      }, _.bind(function (err, confirmed) {
        if (err || !confirmed) { return; }

        return this.updateId(id);
      }, this));
    }

    return this.updateId(id);
  },
  'click .sidebar-toggle': function () {
    var isOpen = !this.el.classList.contains('sidebar-closed');

    this.el.classList[isOpen ? 'add' : 'remove']('sidebar-closed');
  },
  'click .persistence-authenticate':   'authenticate',
  'click .persistence-unauthenticate': 'unauthenticate',
  'click .sidebar-authenticate': function (e) {
    e.preventDefault();
  }
};

/**
 * Require the sidebar template.
 *
 * @type {Function}
 */
SidebarView.prototype.template = require('../../templates/views/sidebar.hbs');

/**
 * Reload the persistent notebooks list.
 */
SidebarView.prototype.updateList = function () {
  this.data.set('updating', true);

  persistence.list(_.bind(function (err, list) {
    this.data.set('updating', false);

    return this.data.set('list', list);
  }, this));
};

/**
 * Add some sidebar helpers.
 *
 * @type {Object}
 */
SidebarView.prototype.helpers = {
  dateFormat: function (date) {
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
  }
};

/**
 * Override the render function to load the initial notebook list.
 */
SidebarView.prototype.render = function () {
  this.listenTo(persistence, 'change:userId', bounce(this.updateList, this));

  return View.prototype.render.call(this);
};

/**
 * Load an id into the persistence layer.
 *
 * @param {String} id
 */
SidebarView.prototype.updateId = function (id) {
  config.set('id', id);
  this.el.querySelector('.sidebar-list').scrollTop = 0;
};

/**
 * Delete an id using the persistence layer.
 *
 * @param {String} id
 */
SidebarView.prototype.deleteId = function (id) {
  middleware.trigger('ui:confirm', {
    title: 'Delete Notebook',
    content: 'Are you sure you want to delete this notebook?' +
    ' Deleted notebooks cannot be restored.'
  }, _.bind(function (err, confirmed) {
    return confirmed && persistence.remove(id, _.bind(function (err) {
      if (err) {
        return middleware.trigger('ui:notify', {
          title: 'Unable to delete the notebook',
          message: 'Refresh and try again'
        });
      }

      if (persistence.get('notebook').get('id') === id) {
        this.updateId('');
      }

      var listItemEl = this.el.querySelector('[data-load="' + id + '"]');
      return listItemEl && listItemEl.parentNode.removeChild(listItemEl);
    }, this));
  }, this));
};

/**
 * Authenticate to the notebook persistence layer.
 */
SidebarView.prototype.authenticate = function () {
  return persistence.authenticate(notifyError('Login failed!'));
};

/**
 * Unauthenticate from the notebook.
 */
SidebarView.prototype.unauthenticate = function () {
  return persistence.unauthenticate(notifyError('Could not log out!'));
};
