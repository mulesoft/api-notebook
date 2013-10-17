/**
 * Generates a ghost text widget that is used to render Chrome-style completion.
 *
 * @param  {Object} widget
 * @param  {Object} data
 * @param  {String} text
 * @return {Ghost}
 */
var Ghost = module.exports = function (widget, data, result) {
  var that = this;
  var text;

  this.cm         = widget.completion.cm;
  this.data       = data;
  this.widget     = widget;
  this.completion = widget.completion;

  this.cm.addKeyMap(this.keyMap = {
    'Tab':   function () { that.accept(); },
    'Right': function () { that.accept(); }
  });

  if (result.special) {
    text = result.value;
  } else {
    var substring = result.value.substr(0, this.data.to.ch - this.data.from.ch);

    if (substring === data.token.string) {
      text = result.value.substr(this.data.to.ch - this.data.from.ch);
    } else {
      return this.remove();
    }
  }

  // Creates the ghost element to be styled.
  var ghostHint = document.createElement('span');
  ghostHint.className = 'CodeMirror-hint-ghost';
  ghostHint.appendChild(document.createTextNode(this.text = text));

  // Abuse the bookmark feature of CodeMirror to achieve the desired completion
  // effect without modifying source code.
  this._ghost = this.cm.setBookmark(this.data.to, {
    widget:     ghostHint,
    insertLeft: true
  });
};

/**
 * Accept the display ghost text.
 *
 * @return {Ghost}
 */
Ghost.prototype.accept = function () {
  if (this.text && this.data) {
    this.cm.replaceRange(this.text, this.data.to, this.data.to);
  }

  return this.remove();
};

/**
 * Remove the ghost suggestion.
 *
 * @return {Ghost}
 */
Ghost.prototype.remove = function () {
  if (this._ghost) { this._ghost.clear(); }

  this.cm.removeKeyMap(this.keyMap);
  delete this.ghost;
  delete this.suffix;
  delete this.widget.ghost;

  return this;
};
