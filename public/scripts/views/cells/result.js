var _    = require('underscore');
var Cell = require('./cell');

var ResultCell = module.exports = Cell.extend({
  className: 'cell cell-result result-pending'
});

ResultCell.prototype.clear = function () {
  this.el.innerHTML = '';
  this.el.classList.add('result-pending');
  this.el.classList.remove('result-error');
  return this;
};

ResultCell.prototype.setResult = function (result) {
  this.clear();
  this.el.appendChild(document.createTextNode(result));
  this.el.classList.remove('result-pending');
  return this;
};

ResultCell.prototype.setError = function (error) {
  this.setResult(error); // Leave the object inspector to take care of rendering
  this.el.classList.add('result-error');
  return this;
};
