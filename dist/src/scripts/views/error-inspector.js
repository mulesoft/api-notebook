var _         = require('underscore');
var trim      = _.bind(Function.prototype.call, String.prototype.trim);
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

  // Check whether we rendering an initialized error.
  this._isError = (type(this.inspect) === 'error' && 'stack' in this.inspect);
};

/**
 * Returns whether the inspector should be expandable.
 *
 * @return {Boolean}
 */
ErrorInspector.prototype.isExpandable = function () {
  if (this._isError) {
    return !!this.inspect.stack.length;
  }

  return Inspector.prototype.isExpandable.call(this);
};

/**
 * Returns the stringified preview. In this case, it will be the error message.
 *
 * @return {String}
 */
ErrorInspector.prototype.stringifyPreview = function () {
  if (this._isError) {
    return Error.prototype.toString.call(this.inspect);
  }

  return Inspector.prototype.stringifyPreview.call(this);
};

/**
 * Render the stack trace as the child.
 *
 * @return {ErrorInspector}
 */
ErrorInspector.prototype._renderChildren = function () {
  // Stack trace rendering support.
  if (this._isError) {
    var stack   = this.inspect.stack;
    var traceEl = document.createElement('div');
    var message = Error.prototype.toString.call(this.inspect);

    // Check for Chrome-style stack traces which include the error message.
    if (stack.substr(0, message.length) === message) {
      stack = _.map(stack.split('\n').slice(1), trim).join('\n');
    }

    // Remove useless Safari eval stack trace line.
    stack = stack.replace(/^eval code\n/, '');

    traceEl.className   = 'inspector-trace';
    traceEl.textContent = stack;

    this.childrenEl.appendChild(traceEl);

    return this;
  }

  return Inspector.prototype._renderChildren.call(this);
};

/**
 * Remove the stack trace from display.
 *
 * @return {ErrorInspector}
 */
ErrorInspector.prototype._removeChildren = function () {
  if (this._isError) {
    this.childrenEl.innerHTML = '';

    return this;
  }

  return Inspector.prototype._removeChildren.call(this);
};
