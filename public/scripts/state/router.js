var Backbone = require('backbone');

/**
 * Exports a simple router used by the application to load and/or create new
 * notebooks. The advantages of having it static for the entire application
 * means it can be manipulated by both the app view, notebook view and
 * persistence model for their respective uses.
 *
 * @type {Object}
 */
module.exports = new (Backbone.Router.extend({
  routes: {
    '':    'newNotebook',
    '*id': 'loadNotebook'
  }
}))();
