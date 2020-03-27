var Backbone = require('backbone');

/**
 * Create a new view instance. This is the base view instance so any generic
 * view methods or functionality should be added here.
 *
 * @type {Function}
 */
var View = module.exports = Backbone.View.extend();

/**
 * Initialize every view with a private data collection. This allows views to
 * hold view specific logic that doesn't belong with a model.
 */
View.prototype.initialize = function () {
  this.data = new Backbone.Model({
    rendered: false
  });
};

/**
 * Render the view instance.
 *
 * @return {this}
 */
View.prototype.render = function () {
  this.el.innerHTML = '';
  this.delegateEvents();
  this.data.set('rendered', true);
  return this;
};

/**
 * Remove the view instance from the DOM.
 *
 * @return {this}
 */
View.prototype.remove = function () {
  // Trigger the `remove` event before actually removing the view since we may
  // need to append a new element afterward, etc.
  this.trigger('remove', this);
  Backbone.View.prototype.remove.call(this);
  return this;
};

/**
 * Insert an element last in the list of child nodes of this view.
 *
 * @param  {Node} el The element to append this view to.
 * @return {this}
 */
View.prototype.appendTo = function (el) {
  if (typeof el.appendChild === 'function') {
    el.appendChild(this.el);
  } else {
    el.call(this, this.el);
  }
  return this;
};

/**
 * Insert an element first in the list of child nodes of this element.
 *
 * @param  {Node} el The element to prepend this view to.
 * @return {this}
 */
View.prototype.prependTo = function (el) {
  return this.appendTo.call(this, function () {
    el.insertBefore(this.el, el.firstChild);
  });
};
