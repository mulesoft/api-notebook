var _        = require('underscore');
var Backbone = require('backbone');

/**
 * Generates a ghost text widget that is used to render Chrome-style completion.
 *
 * @param  {Object} widget
 * @param  {Object} data
 * @param  {String} text
 * @return {Ghost}
 */
var Ghost = module.exports = function (widget, result) {
  this.cm     = widget.completion.cm;
  this.result = result;
  this.widget = widget;

  var that      = this;
  var text      = '';
  var data      = widget.data;
  var substring = this.result.value.substr(0, data.to.ch - data.from.ch);

  if (substring === data.token.string) {
    text = this.result.value.substr(data.to.ch - data.from.ch);
  }

  // Don't create the ghost element if there is no text to display. It makes
  // for a janky UI where keys are blocked thanks to the ghost shortcuts.
  if (!text) { return; }

  this.cm.addKeyMap(this.keyMap = {
    'Tab':   function () { that.accept(); },
    'Right': function () { that.accept(); }
  });

  // Creates the ghost element to be styled.
  var ghostHint = document.createElement('span');
  ghostHint.className = 'CodeMirror-hint-ghost';
  ghostHint.appendChild(document.createTextNode(text));

  // Abuse the bookmark feature of CodeMirror to achieve the desired completion
  // effect without modifying source code.
  this.ghost = this.cm.setBookmark(data.to, {
    widget:     ghostHint,
    insertLeft: true
  });
};

/**
 * Extend the ghost with events.
 */
_.extend(Ghost.prototype, Backbone.Events);

/**
 * Accept the display ghost text.
 */
Ghost.prototype.accept = function () {
  this.trigger('accept', this.result);
};

/**
 * Remove the ghost suggestion.
 */
Ghost.prototype.remove = function () {
  if (this.ghost) {
    this.ghost.clear();
  }

  if (this.keyMap) {
    this.cm.removeKeyMap(this.keyMap);
  }

  delete this.text;
  delete this.ghost;
  delete this.widget.ghost;
};
