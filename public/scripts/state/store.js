var _        = require('underscore');
var storage  = require('store');
var Backbone = require('backbone');

/**
 * The constructor function for a store instance.
 *
 * @type {Function}
 */
var Store = Backbone.Model.extend();

/**
 * Set all the attributes from localStorage on initialization.
 */
Store.prototype.initialize = function () {
  if (!storage.enabled) { return; }

  _.each(storage.getAll(), function (value, key) {
    if (!this._isPersistenceKey(key)) { return; }

    this.attributes[key.substr(this._prefix.length + 1)] = value;
  }, this);
};

/**
 * The prefix for storing in localStorage.
 *
 * @type {String}
 */
Store.prototype._prefix = 'store';

/**
 * Returns the persistence key for localStorage.
 *
 * @param  {String} key
 * @return {String}
 */
Store.prototype._persistenceKey = function (key) {
  return this._prefix + '-' + key;
};

/**
 * Validate a key and check if it is a valid persistence key for this instance.
 *
 * @param  {String}  key
 * @return {Boolean}
 */
Store.prototype._isPersistenceKey = function (key) {
  return key.substr(0, this._prefix.length + 1) === this._prefix + '-';
};

/**
 * Override `set` to also save to localStorage.
 *
 * @param {String} key
 * @param {*}      value
 */
Store.prototype.set = function (key, value, options) {
  var attrs;

  if (typeof key === 'object') {
    attrs   = key;
    options = value;
  } else {
    (attrs = {})[key] = value;
  }

  if (storage.enabled) {
    // Can't seem to ignore the JSHint `for` loop body error here, so this
    // behaviour is inconsistent with `Backbone.prototype.set`.
    for (var attr in attrs) {
      if (_.has(attrs, attr)) {
        var method = options && options.unset ? 'remove' : 'set';
        storage[method](this._persistenceKey(attr), attrs[attr]);
      }
    }
  }

  return Backbone.Model.prototype.set.apply(this, arguments);
};

/**
 * Override `clear` to also empty localStorage.
 */
Store.prototype.clear = function () {
  // Check all the keys in persistent store and remove keys active for this
  // instance.
  if (storage.enabled) {
    _.each(storage.getAll(), function (value, key) {
      if (this._isPersistenceKey(key)) {
        storage.remove(key);
      }
    }, this);
  }

  return Backbone.Model.prototype.clear.apply(this, arguments);
};

/**
 * Override `unset` to also remove the key from localStorage.
 */
Store.prototype.unset = function (key) {
  if (storage.enabled) {
    storage.remove(this._persistenceKey(key));
  }

  return Backbone.Model.prototype.unset.call(this, key);
};

/**
 * Generate a custom storage scheme and attach to the regular store.
 *
 * @param  {String} name
 * @return {Object}
 */
Store.prototype.customStore = function (name) {
  if (!_.isString(name)) {
    throw new Error('Custom stores require a storage prefix');
  }

  var CustomStore = this.constructor.extend({
    _prefix: name
  });

  return (this._ || (this._ = {}))[name] = new CustomStore();
};

/**
 * Export a static instance of the store model.
 *
 * @type {Store}
 */
module.exports = new Store();
