var Backbone = require('backbone');

/**
 * Plain cell model for use in the notebook collection.
 *
 * @type {Function}
 */
module.exports = Backbone.Model.extend({
  defaults: {
    type: 'text',
    value: ''
  }
});
