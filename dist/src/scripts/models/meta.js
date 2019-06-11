var _        = require('underscore');
var Backbone = require('backbone');

/**
 * Model used for holding a notebooks meta data.
 *
 * @type {Function}
 */
var Meta = module.exports = Backbone.Model.extend();

/**
 * Reset a model by removing any unused attributes and updating everything else.
 *
 * @param  {Object} attrs
 * @param  {Object} options
 * @return {Meta}
 */
Meta.prototype.reset = function (attrs, options) {
  this.set(
    _.omit(this.attributes, _.keys(attrs)),
    _.extend({}, options, { unset: true })
  );

  this.set(attrs);

  return this;
};
