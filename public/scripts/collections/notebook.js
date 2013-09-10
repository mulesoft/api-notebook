var _        = require('underscore');
var trim     = require('trim');
var Backbone = require('backbone');

var OPEN_CODE_BLOCK  = '```javascript';
var CLOSE_CODE_BLOCK = '```';

var Notebook = module.exports = Backbone.Collection.extend({
  model: require('../models/cell'),
  comparator: function (model) {
    if (!model.view || !model.view.el.parentNode) { return this.length; }
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

/**
 * This method is used only for serializing the notebook for evaluation with the
 * eval function in the iframe context. It allows us to easier lookup any
 * previous results using a specific syntax
 *
 * @return {Object}
 */
Notebook.prototype.serializeForEval = function () {
  var object = {};
  this.each(function (model) {
    if (_.isUndefined(model._uniqueCellId)) { return; }
    object['$' + model._uniqueCellId] = model.get('result');
  });
  return object;
};

Notebook.prototype.serializeForGist = function () {
  return this.map(function (model) {
    if (model.get('type') === 'text') { return model.get('value'); }
    // Wrap code cells as a JavaScript code block for Markdown
    return [OPEN_CODE_BLOCK, model.get('value'), CLOSE_CODE_BLOCK].join('\n');
  }).join('\n\n');
};

Notebook.prototype.deserializeFromGist = function (gist) {
  var type       = 'text';
  var value      = [];
  var collection = [];

  var resetParser = function (newType) {
    // Text cells need to cater for the first line being empty since we are
    // joining the sections together with two newlines.
    if (type === 'text' && value[0] === '') { value.shift(); }

    if (!value.length) { return type = newType; }

    value = value.join('\n');

    collection.push({
      type:  type,
      value: value
    });

    type  = newType;
    value = [];
  };

  _.each((gist || '').split('\n'), function (line) {
    if (line === OPEN_CODE_BLOCK) {
      return resetParser('code');
    }

    if (type === 'code' && line === CLOSE_CODE_BLOCK) {
      return resetParser('text');
    }

    value.push(line);
  });

  resetParser();

  return collection;
};
