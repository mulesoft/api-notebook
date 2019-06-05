var _        = require('underscore');
var Backbone = require('backbone');

/**
 * Holds all the notebook cell contents.
 *
 * @return {Object}
 */
var Notebook = module.exports = Backbone.Collection.extend({
  model: require('../models/cell'),
  comparator: function (model) {
    if (!model.view || !model.view.el.parentNode) { return this.length; }
    // Sorting the collection based on positions in the DOM
    return _.indexOf(model.view.el.parentNode.childNodes, model.view.el);
  }
});

/**
 * Return the next model in the collection.
 *
 * @param  {Object} model
 * @return {Object}
 */
Notebook.prototype.getNext = function (model) {
  var index = this.indexOf(model);
  // Catch not found indexes, where adding one would result in the first model.
  return index > -1 ? this.at(index + 1) : undefined;
};

/**
 * Return the previous model in the collection.
 *
 * @param  {Object} model
 * @return {Object}
 */
Notebook.prototype.getPrev = function (model) {
  return this.at(this.indexOf(model) - 1);
};

/**
 * Return the next code cell in the collection.
 *
 * @param  {Object} model
 * @return {Object}
 */
Notebook.prototype.getNextCode = function (model) {
  while (model = this.getNext(model)) {
    if (model.get('type') === 'code') {
      return model;
    }
  }
};

/**
 * Return the previous code cell in the collection.
 *
 * @param  {Object} model
 * @return {Object}
 */
Notebook.prototype.getPrevCode = function (model) {
  while (model = this.getPrev(model)) {
    if (model.get('type') === 'code') {
      return model;
    }
  }
};

/**
 * Get the index of the model iterating over only code cells.
 *
 * @param  {Object} model
 * @return {Number}
 */
Notebook.prototype.codeIndexOf = function (model) {
  return _.indexOf(this.filter(function (model) {
    return model.get('type') === 'code';
  }), model);
};
