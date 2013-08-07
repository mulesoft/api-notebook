var View = require('./view');

var HbsView = module.exports = View.extend();

HbsView.prototype.render = function () {
  this.el.innerHTML = '';
  this.el.innerHTML = this.template(this.model && this.model.toJSON());
  this.delegateEvents();
  return this;
};
