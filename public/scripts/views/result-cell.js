var _          = require('underscore');
var domify     = require('domify');
var Cell       = require('./cell');
var middleware = require('../state/middleware');

var ResultCell = module.exports = Cell.extend({
  className: 'cell cell-result result-pending'
});

ResultCell.prototype.initialize = function () {
  this.data = {}; // Set a unique empty object for every result cell
  Cell.prototype.initialize.apply(this, arguments);
};

ResultCell.prototype._reset = function (done) {
  middleware.trigger('result:empty', {
    el:   this.el,
    data: this.data
  }, function (err, data) {
    data.el.classList.add('result-pending');
    data.el.classList.remove('result-error');
    done(err);
  });
};

ResultCell.prototype.setResult = function (data, context, done) {
  this._reset(_.bind(function (err) {
    if (err) { return done && done(err); }

    middleware.trigger('result:render', {
      el:      this.el,
      data:    this.data,
      context: context,
      inspect: data.result,
      isError: data.isError
    }, function (err, data) {
      if (data.isError) {
        data.el.classList.add('result-error');
      }
      data.el.classList.remove('result-pending');
      return done && done(err);
    });
  }, this));
};

ResultCell.prototype.refresh = function () {
  if (this._resultLabel) {
    var index = this.model.collection.indexOf(this.model);
    this._resultLabel.textContent = '$' + index + '=';
  }
};

ResultCell.prototype.render = function () {
  Cell.prototype.render.call(this);

  // Prepends a container for the result reference label.
  this.el.appendChild(this._resultLabel = domify(
    '<div class="result-label"></div>'
  ));

  return this;
};
