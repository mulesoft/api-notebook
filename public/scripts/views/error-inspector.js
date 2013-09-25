var _         = require('underscore');
var trim      = require('trim');
var domify    = require('domify');
var type      = require('../lib/type');
var Inspector = require('./inspector');

/**
 * Create an instance of the inspector suited for rendering errors.
 *
 * @type {Function}
 */
var ErrorInspector = module.exports = Inspector.extend();

/**
 * Runs when a new error inspector instance is created.
 */
ErrorInspector.prototype.initialize = function () {
  Inspector.prototype.initialize.apply(this, arguments);

  if (type(this.inspect) === 'error' && 'stack' in this.inspect) {
    this._stackTrace = _.map(this.inspect.stack.split('\n'), trim.left);
    this._preview    = this._stackTrace.shift();

    // May as well delete the reference to the error, avoiding any potential
    // memory leaks. Once rendered, we shouldn't need to use it again anyway.
    delete this.inspect;
  }
};

/**
 * Returns whether the inspector should be expandable.
 *
 * @return {Boolean}
 */
ErrorInspector.prototype.isExpandable = function () {
  if (this._stackTrace) {
    return !!this._stackTrace.length;
  }

  return Inspector.prototype.isExpandable.call(this);
};

/**
 * Returns the stringified preview. In this case, it will be the error message.
 *
 * @return {String}
 */
ErrorInspector.prototype.stringifyPreview = function () {
  if (this._stackTrace) {
    return this._preview;
  }

  return Inspector.prototype.stringifyPreview.call(this);
};

/**
 * Render all child nodes.
 *
 * @return {ErrorInspector}
 */
ErrorInspector.prototype.renderChildren = function () {
  if (!this.isExpandable()) {
    return this;
  }

  // Stack trace rendering support.
  if (this._stackTrace) {
    this._renderChildrenEl();

    this.el.classList.add('can-expand');

    this.childrenEl.appendChild(
      domify(_.map(this._stackTrace, function (trace) {
        return '<div class="trace">' + _.escape(trace) + '</div>';
      }).join('\n'))
    );

    return this;
  }

  return Inspector.prototype.renderChildren.call(this);
};
