var _         = require('underscore');
var Cell      = require('./cell');
var Inspector = require('../inspector');

var ResultCell = module.exports = Cell.extend({
  className: 'cell cell-result result-pending'
});

ResultCell.prototype.reset = function () {
  if (this.inspector) { this.inspector.remove(); }
  this.el.classList.add('result-pending');
  this.el.classList.remove('result-error');
  return this;
};

ResultCell.prototype.setResult = function (result, context) {
  this.reset();
  this.inspector = new Inspector({ inspect: result, context: context });
  this.inspector.render().appendTo(this.el);
  this.el.classList.remove('result-pending');
  return this;
};

ResultCell.prototype.setError = function (error, context) {
  this.setResult(error, context);
  this.el.classList.add('result-error');
  return this;
};
