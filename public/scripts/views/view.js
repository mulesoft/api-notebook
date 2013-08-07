var Backbone = require('backbone');

var View = module.exports = Backbone.View.extend();

View.prototype.render = function () {
  this.el.innerHTML = '';
  return this;
};

View.prototype.remove = function () {
  // Trigger the `remove` event before actually removing the view since we may
  // need to append a new element afterward, etc. Also needs to be called before
  // `#off()` - no events will work anymore after calling it.
  this.trigger('remove', this);
  this.off();
  Backbone.View.prototype.remove.call(this);
  return this;
};

View.prototype.appendTo = function (el) {
  if (typeof el.appendChild === 'function') {
    el.appendChild(this.el);
  } else {
    el.call(this, this.el);
  }
  return this;
};
