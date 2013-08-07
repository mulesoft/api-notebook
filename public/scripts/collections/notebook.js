var _        = require('underscore');
var Backbone = require('backbone');

var Console = module.exports = Backbone.Collection.extend({
  model: require('../models/entry'),
  comparator: function (model) {
    // Sorting the collection based on positions in the DOM
    return _.indexOf(model.view.el.parentNode.childNodes, model.view.el);
  }
});
