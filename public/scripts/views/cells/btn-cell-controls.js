var Backbone = require('backbone');
var domify = require('domify');
var View = require('../view');

var BtnCellControls = module.exports = View.extend({
  className: 'btn btn-show-cell-controls',
  tagName: 'button',
  attributes: {
    type: 'button'
  },
  events: {
    'click': 'onClick'
  }
});

BtnCellControls.prototype.initialize = function (options) {
  this.parent = options.parent;
};

BtnCellControls.prototype.render = function () {
  this.el.innerHTML = '≡'; // U+2261
  return this;
};

BtnCellControls.prototype.onClick = function (event) {
  if (this.parent) {
    event.stopPropagation();
    event.cancelBubble = true; // IE
    this.parent.trigger('show-cell-controls', this.parent);
  }
};