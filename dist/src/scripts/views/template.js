var View = require('./view');

// State modules should be provided as the default data with every view.
var state       = require('../state/state');
var config      = require('../state/config');
var persistence = require('../state/persistence');

/**
 * Create a new view instance that uses the DOMBars templating engine.
 *
 * @type {Function}
 */
var TemplateView = module.exports = View.extend();

/**
 * The template property should be set on any extending views, and is executed
 * on render.
 *
 * @type {Function}
 */
TemplateView.prototype.template = function () {};

/**
 * Render the template using the element using the template function.
 *
 * @return {this}
 */
TemplateView.prototype.render = function () {
  View.prototype.render.call(this);

  this.rendered = this.template(this.model, {
    data: {
      view:        this,
      data:        this.data,
      state:       state,
      config:      config,
      persistence: persistence
    },
    helpers: this.helpers
  });

  if (this.rendered.value) {
    this.el.appendChild(this.rendered.value);
  }

  return this;
};

/**
 * Unsubscribe the template listeners before removal.
 */
TemplateView.prototype.remove = function () {
  if (this.rendered) {
    this.rendered.unsubscribe();
    delete this.rendered;
  }

  return View.prototype.remove.call(this);
};
