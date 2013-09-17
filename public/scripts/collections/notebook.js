var _          = require('underscore');
var Backbone   = require('backbone');
var middleware = require('../state/middleware');

var Notebook = module.exports = Backbone.Collection.extend({
  model: require('../models/cell'),
  comparator: function (model) {
    if (!model.view || !model.view.el.parentNode) { return this.length; }
    // Sorting the collection based on positions in the DOM
    return _.indexOf(model.view.el.parentNode.childNodes, model.view.el);
  }
});

Notebook.prototype.initialize = function () {
  // Augments sandbox context collection result lookups
  middleware.use('sandbox:context', _.bind(function (data, next) {
    this.each(function (model, index) {
      if (model.get('type') === 'code') {
        data['$' + index] = model.get('result');
      }
    });

    return next();
  }, this));
};

Notebook.prototype.getNext = function (model) {
  var index = this.indexOf(model);
  return index < this.length - 1 ? this.at(index + 1) : undefined;
};

Notebook.prototype.getPrev = function (model) {
  var index = this.indexOf(model);
  return index > 0 ? this.at(index - 1) : undefined;
};

Notebook.prototype.getNextCode = function (model) {
  while (model = this.getNext(model)) {
    if (model.get('type') === 'code') {
      return model;
    }
  }
};

Notebook.prototype.getPrevCode = function (model) {
  while (model = this.getPrev(model)) {
    if (model.get('type') === 'code') {
      return model;
    }
  }
};
