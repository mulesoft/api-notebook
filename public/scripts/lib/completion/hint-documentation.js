var _        = require('underscore');
var Backbone = require('backbone');
var state    = require('../../state/state');
var format   = require('./format-documentation');

/**
 * Create a floating documentation widget next to the current hint widget.
 *
 * @constructor
 * @param  {Hints}    hints
 * @param  {Object}   description
 * @return {HintDocs}
 */
var HintDocs = module.exports = function (hints, description) {
  this.hints = hints;

  var prefix  = 'CodeMirror-hint-documentation-';
  var fnName  = hints.results[hints.currentHint].value;
  var tooltip = this.tooltip = document.createElement('div');

  // Map the documentation to the tooltip rendering.
  var docs = _.object(_.map(format(description, fnName), function (docs, type) {
    if (type === 'url') {
      docs = '<a href="' + docs + '" target="_blank">Read more</a>';
    }

    return [type, '<div class="' + prefix + type + '">' + docs + '</div>'];
  }));

  tooltip.className = 'CodeMirror-hint-documentation';
  tooltip.setAttribute('data-overflow-scroll', 'true');

  // Append each part of the documentation.
  tooltip.innerHTML += docs.type || '';
  tooltip.innerHTML += docs.doc  || '';
  tooltip.innerHTML += docs.url  || '';

  document.body.appendChild(tooltip);

  this.reposition();
  this.listenTo(hints, 'reposition', this.reposition, this);
};

/**
 * Extend the documentation tooltip with events.
 */
_.extend(HintDocs.prototype, Backbone.Events);

/**
 * Reposition the documentation tooltip beside the hints menu.
 */
HintDocs.prototype.reposition = function () {
  var hints     = this.hints.hints;
  var box       = hints.getBoundingClientRect();
  var tooltip   = this.tooltip;
  var margin    = parseInt(window.getComputedStyle(tooltip).marginTop, 10);
  var winWidth  = state.get('viewportWidth');
  var docHeight = state.get('documentHeight');

  tooltip.style.top    = hints.offsetTop - margin + 'px';
  tooltip.style.left   = box.right + 'px';
  tooltip.style.right  = 'auto';
  tooltip.style.bottom = 'auto';

  if (winWidth - box.right < box.left) {
    tooltip.style.left  = 'auto';
    tooltip.style.right = winWidth - box.left + 'px';
  }

  if (hints.className.indexOf('CodeMirror-hints-top') > -1) {
    var bottom = docHeight - window.scrollY - box.bottom - margin;

    tooltip.style.top    = 'auto';
    tooltip.style.bottom = bottom + 'px';
  }

  this.trigger('reposition');
};

/**
 * Remove the hint documentation from the DOM.
 */
HintDocs.prototype.remove = function () {
  this.stopListening();
  document.body.removeChild(this.tooltip);
  delete this.tooltip;
  delete this.hints.documentation;
};
