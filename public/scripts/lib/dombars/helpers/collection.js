var _       = require('underscore');
var DOMBars = require('dombars/runtime');

/**
 * Render a Backbone collection inside a DOMBars views.
 *
 * @param  {Object} collection
 * @param  {Object} options
 * @return {Node}
 */
DOMBars.registerHelper('collection', function (collection, options) {
  var element   = DOMBars.Utils.trackNode();
  var templates = {};

  if (!collection || arguments.length < 2) {
    return element;
  }

  /**
   * Render a model using the helper function. Cache the rendered child nodes
   * and returned fragment for removal.
   *
   * @param  {Object} model
   * @return {Node}
   */
  var render = function (model) {
    var child = templates[model.cid] = options.fn(model);

    // Wrap the node value in a tracking node.
    return child.value = DOMBars.Utils.trackNode(child.value);
  };

  /**
   * Append a new model directly to the current element.
   *
   * @param {Object} model
   */
  var add = function (model) {
    element.appendChild(render(model).fragment);
  };

  /**
   * Sort DOM nodes by removing from the DOM and re-adding in sorted order.
   */
  var sort = function () {
    _.each(templates, function (template) {
      return template.value.remove();
    });

    collection.each(function (model) {
      element.appendChild(templates[model.cid].value.fragment);
    });
  };

  /**
   * Destroy a template from existence.
   *
   * @param {String} cid
   */
  var destroy = function (cid) {
    templates[cid].unsubscribe();
    templates[cid].value.remove();
    delete templates[cid];
  };

  /**
   * Remove nodes from the DOM.
   *
   * @param {Object} model
   */
  var remove = function (model) {
    return destroy(model.cid);
  };

  /**
   * Remove all DOM nodes from the DOM.
   *
   * @return {[type]} [description]
   */
  var reset = function () {
    _.each(templates, function (template, key) {
      return destroy(key);
    });
  };

  options.unsubscribe(function () {
    collection.off('add',    add);
    collection.off('sort',   sort);
    collection.off('reset',  reset);
    collection.off('remove', remove);
  });

  collection.on('add',    add);
  collection.on('sort',   sort);
  collection.on('reset',  reset);
  collection.on('remove', remove);

  collection.each(add);

  return element.fragment;
});
