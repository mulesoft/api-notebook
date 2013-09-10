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

ResultCell.prototype.setResult = function (inspect, isError, context, done) {
  this._reset(_.bind(function (err) {
    if (err) { return done && done(err); }

    middleware.trigger('result:render', {
      el:      this.el,
      data:    this.data,
      context: context,
      inspect: inspect,
      isError: isError
    }, function (err, data) {
      if (isError) {
        data.el.classList.add('result-error');
      }
      data.el.classList.remove('result-pending');
      return done && done(err);
    });
  }, this));
};

ResultCell.prototype.render = function () {
  Cell.prototype.render.call(this);

  this.el.appendChild(domify(
    '<div class="result-label">$' + this.model._uniqueCellId + '= </div>'
  ));

  return this;
};
