var _     = require('underscore');
var state = require('../../state/state');

/**
 * Renders a documentation tooltip.
 *
 * @param  {Completion} completion
 * @param  {Object}     data
 * @return {Tooltip}
 */

var Tooltip = module.exports = function (completion, data) {
  this.data       = data;
  this.completion = completion;

  CodeMirror.signal(completion.cm, 'startTooltip', completion.cm);

  return this.render();
};

/**
 * Render the tooltip based on the description object.
 *
 * @return {Tooltip}
 */
Tooltip.prototype.render = function () {
  var description = this.data.description;

  this.removeTooltip();

  // Needs the type or a description at minimum to render.
  if (!description['!type'] && !description['!doc']) {
    return this;
  }

  this._tooltip = document.createElement('div');
  this._tooltip.className = 'CodeMirror-tooltip';

  if (description['!type']) {
    var typeEl = this._tooltip.appendChild(document.createElement('div'));
    typeEl.className = 'CodeMirror-tooltip-type';
    typeEl.appendChild(document.createTextNode(description['!type']));
  }

  if (description['!doc']) {
    var docEl = this._tooltip.appendChild(document.createElement('div'));
    docEl.className = 'CodeMirror-tooltip-doc';
    docEl.appendChild(document.createTextNode(description['!doc']));

    if (description['!url']) {
      docEl.appendChild(document.createTextNode(' '));

      var infoEl = docEl.appendChild(document.createElement('a'));
      infoEl.href      = description['!url'];
      infoEl.target    = '_blank';
      infoEl.className = 'CodeMirror-tooltip-doc-url';
      infoEl.appendChild(document.createTextNode('Read more'));
    }
  }

  // Append the tooltip to the DOM.
  document.body.appendChild(this._tooltip);

  this.reposition();

  // Listen to changes in the viewport size and reposition the tooltip.
  state.on('change:window.width', this.onResize = _.bind(
    this.reposition, this
  ));

  return this;
};

/**
 * Position the tooltip in the window.
 *
 * @return {[type]} [description]
 */
Tooltip.prototype.reposition = function () {
  var pos = this.completion.cm.cursorCoords(this.data.to);

  this._tooltip.style.position = 'absolute';
  this._tooltip.style.top      = pos.bottom + 'px';
  this._tooltip.style.left     = pos.left   + 'px';

  var tooltip    = this._tooltip.getBoundingClientRect();
  var winWidth   = state.get('window.width');
  var rightWidth = tooltip.right - tooltip.left;

  if (tooltip.right > winWidth - 5 && tooltip.left > rightWidth) {
    this._tooltip.className += ' CodeMirror-tooltip-right';
    this._tooltip.style.left  = 'auto';
    this._tooltip.style.right = winWidth - pos.left + 'px';
  }

  return this;
};

/**
 * Destroy the tooltip DOM element.
 *
 * @return {Tooltip}
 */
Tooltip.prototype.removeTooltip = function () {
  if (this._tooltip) {
    this._tooltip.parentNode.removeChild(this._tooltip);
    delete this._tooltip;
  }

  state.off('change:window.width', this.onResize);
  delete this.onResize;

  return this;
};

/**
 * Remove the tooltip from the DOM.
 *
 * @return {Tooltip}
 */
Tooltip.prototype.remove = function () {
  this.removeTooltip();

  CodeMirror.signal(this.completion.cm, 'endTooltip', this.completion.cm);

  return this;
};
