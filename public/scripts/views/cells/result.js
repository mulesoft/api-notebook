var _              = require('underscore');
var domify         = require('domify');
var type           = require('../../lib/type');
var Cell           = require('./cell');
var Inspector      = require('../inspector');
var ErrorInspector = require('../error-inspector');

var ResultCell = module.exports = Cell.extend({
  className: 'cell cell-result result-pending'
});

ResultCell.prototype._reset = function () {
  if (this.inspector) { this.inspector.remove(); }
  this.el.classList.add('result-pending');
  this.el.classList.remove('result-error');
  return this;
};

ResultCell.prototype._renderInspector = function (Inspector, options) {
  this._reset();
  this.inspector = new Inspector(options);
  this.inspector.render().appendTo(this.el);
  this.el.classList.remove('result-pending');
  // Open the inspector automatically when the type is an object
  var typeOf = type(this.inspector.inspect);
  if (typeOf === 'object' || typeOf === 'array') {
    this.inspector.open();
  }
  return this;
};

ResultCell.prototype.setResult = function (result, context) {
  this._renderInspector(Inspector, { inspect: result, context: context });
  return this;
};

ResultCell.prototype.setError = function (error, context) {
  this._renderInspector(ErrorInspector, { inspect: error, context: context });
  this.el.classList.add('result-error');
  return this;
};

ResultCell.prototype.render = function () {
  Cell.prototype.render.call(this);

  this.el.appendChild(domify(
    '<div class="result-label">$' + this.model._uniqueCellId + '= </div>'
  ));

  return this;
};
