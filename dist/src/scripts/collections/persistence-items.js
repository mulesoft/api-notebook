var Backbone = require('backbone');

/**
 * A Backbone Collection designed to keep track of all notebooks, allowing
 * us to hit the network as infrequently as possible.
 *
 * @type {Function}
 */
var PersistenceItems = module.exports = Backbone.Collection.extend({
  model: require('../models/persistence-item')
});

/**
 * Here we register to have Backbone keep this collection sorted for us.
 *
 * @param  {PersistenceItem} a
 * @param  {PersistenceItem} b
 * @return {Number}
 */
PersistenceItems.prototype.comparator = function (a, b) {
  return +a.get('updatedAt') > +b.get('updatedAt') ? -1 : 1;
};
