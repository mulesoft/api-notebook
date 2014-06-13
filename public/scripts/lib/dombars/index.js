var DOMBars  = module.exports = require('dombars/runtime');
var _        = require('underscore');
var Backbone = require('backbone');

/**
 * Register a custom get method for Backbone views.
 *
 * @param  {Object} obj
 * @param  {String} property
 * @return {*}
 */
DOMBars.get = function (obj, property) {
  if (obj instanceof Backbone.Model) {
    return obj.get(property);
  }

  return obj[property];
};

/**
 * Provide a subscription method for handling Backbone models.
 *
 * @param {Object}   obj
 * @param {String}   property
 * @param {Function} fn
 */
DOMBars.subscribe = function (obj, property, fn) {
  if (!(obj instanceof Backbone.Model)) { return; }

  obj.on('change:' + property, fn);
};

/**
 * Provide an unsubscribe method for removing Backbone model listeners.
 *
 * @param {Object}   obj
 * @param {String}   property
 * @param {Function} fn
 */
DOMBars.unsubscribe = function (obj, property, fn) {
  if (!(obj instanceof Backbone.Model)) { return; }

  obj.off('change:' + property, fn);
};

/**
 * Add a utility function for merging multiple templates together.
 *
 * @return {Function}
 */
DOMBars.Utils.mergeTemplates = function (/* ...templates */) {
  if (arguments.length < 2) {
    return arguments[0];
  }

  var args = _.toArray(arguments);

  return function (context, options) {
    var result = {};

    // Set the value to be a document fragment.
    result.value = document.createDocumentFragment();

    // Iterate over each of the templates and track the returned child.
    var templates = _.map(args, function (template) {
      return template(context, options);
    });

    // Add an unsubscribe method the will delegate to each of the templates.
    result.unsubscribe = function () {
      _.each(templates, function (template) {
        template.unsubscribe();
      });
    };

    // Append all the templates to the document fragment.
    _.each(templates, function (template) {
      if (!template.value) { return; }

      result.value.appendChild(template.value);
    });

    return result;
  };
};

/**
 * Register DOMBars helpers.
 */
require('./helpers/if');
require('./helpers/view');
require('./helpers/equal');
require('./helpers/collection');
