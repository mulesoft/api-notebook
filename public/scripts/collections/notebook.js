var _        = require('underscore');
var Backbone = require('backbone');

var Notebook = module.exports = Backbone.Collection.extend({
  model: require('../models/entry'),
  comparator: function (model) {
    // Sorting the collection based on positions in the DOM
    return _.indexOf(model.view.el.parentNode.childNodes, model.view.el);
  }
});

Notebook.prototype.getNext = function (model) {
  var index = this.indexOf(model);
  return index < this.length - 1 ? this.at(index + 1) : undefined;
};

Notebook.prototype.getPrev = function (model) {
  var index = this.indexOf(model);
  return index > 0 ? this.at(index - 1) : undefined;
};

/**
 * This method is used only for serializing the notebook for evaluation with the
 * eval function in the iframe context. It allows us to easier lookup any
 * previous results using a specific syntax
 *
 * @return {Object}
 */
Notebook.prototype.serializeForEval = function () {
  var object = {};
  this.forEach(function (model) {
    if (_.isUndefined(model._uniqueCellId)) { return; }
    object['$' + model._uniqueCellId] = model.get('result');
  });
  return object;
};
