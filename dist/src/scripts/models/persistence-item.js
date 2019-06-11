var Backbone = require('backbone');

/**
 * Just a placeholder for the list of notebooks that the persistence plugin
 * maintains. Two fields.
 */
module.exports = Backbone.Model.extend({
  defaults: {
    id:        null,
    updatedAt: null
  }
});
