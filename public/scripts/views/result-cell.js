var _          = require('underscore');
var domify     = require('domify');
var Cell       = require('./cell');
var middleware = require('../state/middleware');

/**
 * Return a new result cell instance.
 *
 * @type {Function}
 */
var ResultCell = module.exports = Cell.extend({
  className: 'cell cell-result result-pending'
});

/**
 * Reset the result cell view to the original state.
 *
 * @param {Function} done
 */
ResultCell.prototype._reset = function (done) {
  middleware.trigger('result:empty', this._view, _.bind(function (err) {
    delete this._view;

    this.el.classList.add('result-pending');
    this.el.classList.remove('result-error');

    return done && done(err);
  }, this));
};

/**
 * Render the result view.
 *
 * @param {Object}   data
 * @param {Object}   context
 * @param {Function} done
 */
ResultCell.prototype.setResult = function (data, context, done) {
  this._reset(_.bind(function (err) {
    if (err) { return done && done(err); }

    middleware.trigger('result:render', {
      el:      this.el,
      context: context,
      inspect: data.result,
      isError: data.isError
    }, _.bind(function (err, view) {
      this._view = view;

      if (data.isError) {
        this.el.classList.add('result-error');
      }
      this.el.classList.remove('result-pending');

      return done && done(err);
    }, this));
  }, this));
};

/**
 * Refreshes the result cell based on the parent cell view.
 *
 * @return {ResultCell}
 */
ResultCell.prototype.refresh = function () {
  if (this._resultLabel) {
    var index = this.model.collection.codeIndexOf(this.model);
    this._resultLabel.textContent = '$' + index + '=';
  }

  return this;
};

/**
 * Render the result cell. This is a fairly simple view since all the rendering
 * will actually occur at a later time.
 *
 * @return {ResultCell}
 */
ResultCell.prototype.render = function () {
  Cell.prototype.render.call(this);

  // Prepends a container for the result reference label.
  this.el.appendChild(this._resultLabel = domify(
    '<div class="result-label"></div>'
  ));

  return this;
};
