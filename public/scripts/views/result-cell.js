var _          = require('underscore');
var View       = require('./template');
var messages   = require('../state/messages');
var template   = require('../../templates/views/result-cell.hbs');
var middleware = require('../state/middleware');

/**
 * Return a new result cell instance.
 *
 * @type {Function}
 */
var ResultCell = module.exports = View.extend({
  className: 'cell cell-result cell-result-pending'
});

/**
 * Automatically update the result body on change.
 */
ResultCell.prototype.change = function () {
  this.empty();

  if (this.model.get('isError')) {
    this.el.classList.add('result-error');
  }

  var attachElement  = this.el.querySelector('.result-content');
  var notebookWindow = this.model.view ?
    this.model.view.notebook.sandbox.window : window;

  middleware.trigger('result:render', {
    el:      attachElement,
    window:  notebookWindow,
    inspect: this.model.get('result'),
    isError: this.model.get('isError')
  }, _.bind(function (err, remove) {
    if (typeof remove === 'function') {
      this._remove = remove;
    }

    // Avoid an empty element when rendering fails.
    if (!attachElement.childNodes.length) {
      attachElement.innerHTML = '&nbsp;';
    }

    this.el.classList.remove('cell-result-pending');
    messages.trigger('resize');
  }, this));

  return this;
};

/**
 * The result cell template.
 *
 * @type {Function}
 */
ResultCell.prototype.template = template;

/**
 * Refreshes the result cell based on the parent cell view.
 */
ResultCell.prototype.update = function () {
  if (this.model.collection) {
    this.data.set('index', this.model.collection.codeIndexOf(this.model));
  }

  return this;
};

/**
 * Empty the result cell.
 */
ResultCell.prototype.empty = function () {
  // Any views must subscribe to this API style.
  if (this._remove) {
    this._remove();
    delete this._remove;
  }

  // Force the element to be cleared.
  this.el.querySelector('.result-content').innerHTML = '';

  return this;
};

/**
 * Empty the cell before removing.
 */
ResultCell.prototype.remove = function () {
  this.empty();
  return View.prototype.remove.call(this);
};
