var View   = require('./view');
var domify = require('domify');

var BtnCellControls = module.exports = View.extend({
  tagName: 'button',
  className: 'btn btn-show-cell-controls',
  attributes: {
    type: 'button'
  },
  events: {
    'mousedown':  'onClick',
    'touchstart': 'onClick'
  }
});

BtnCellControls.prototype.render = function () {
  this.el.innerHTML = '≡'; // U+2261
  return this;
};

BtnCellControls.prototype.onClick = function (e) {
  e.preventDefault();
  e.stopPropagation();
  e.cancelBubble = true; // IE
  this.trigger('showControls', this);
};
