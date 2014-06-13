var Widget         = require('./widget');
var ArgumentDocs   = require('./argument-documentation');
var loadArguments  = require('../codemirror/sandbox-arguments');
var loadCompletion = require('../codemirror/sandbox-completion');

var CLOSE_REGEXP = /[^$_a-zA-Z0-9]/;

/**
 * Create a completion instance for a CodeMirror editor.
 *
 * @constructor
 * @param  {CodeMirror} cm
 * @param  {Object}     options
 * @return {Completion}
 */
var Completion = module.exports = function (cm, options) {
  var that          = this;
  var closeOnCursor = true;
  var closeOnBlur;

  this.cm      = cm;
  this.options = options || {};

  this.cm.state.completionActive = this;

  /**
   * Close the currently open widget when we exit the editor.
   */
  this.onBlur = function () {
    closeOnBlur = window.setTimeout(function () {
      that.removeWidget();
      that.removeArgumentDocumentation();
    }, 20);
  };

  /**
   * On editor focus, we clear the current blur timeout.
   */
  this.onFocus = function () {
    // Timeout documentation display to avoid incorrect cursor positioning.
    setTimeout(function () {
      if (!that.documentation) {
        that.showArgumentDocumentation();
      }
    }, 10);

    window.clearTimeout(closeOnBlur);
  };

  /**
   * Change events are where all the action happens.
   * @param  {CodeMirror} cm
   * @param  {Object}     event
   */
  this.onChange = function (cm, event) {
    closeOnCursor = false;

    // Only update the display when we are inserting or deleting characters
    if (!event.origin || event.origin.charAt(0) !== '+') {
      return that.removeWidget();
    }

    var remove  = event.origin === '+delete';
    var text    = event[remove ? 'removed' : 'text'].join('\n');
    var line    = cm.getLine(event.from.line);
    var curPos  = event.from.ch + (remove ? -1 : 0);
    var curChar = line.charAt(curPos);

    // Checks whether any of the characters are a close character. If they are,
    // close the widget and remove from the DOM. However, we should also close
    // the widget when there is no previous character.
    if (!curChar || CLOSE_REGEXP.test(curChar) || CLOSE_REGEXP.test(text)) {
      that.removeWidget();
    } else if (curPos > 0 && CLOSE_REGEXP.test(line.charAt(curPos - 1))) {
      that.removeWidget();
    }

    var nextChar = line.charAt(curPos + 1);

    // If completion is currently active, trigger a refresh event (filter the
    // current suggestions using updated character position information).
    // Otherwise, we need to show a fresh widget.
    if (that.widget) {
      that.widget.update();
    } else if (!nextChar || CLOSE_REGEXP.test(nextChar)) {
      that.showWidget();
    }
  };

  /**
   * Cursor activity should close the widget, except for when the activity is
   * actually the result of some text input.
   *
   * @param  {CodeMirror} cm
   */
  this.onCursorActivity = function (cm) {
    // Cursor activity is getting triggered when we don't have focus.
    if (!cm.hasFocus() || cm.getOption('readOnly')) { return; }

    // If we already have active documentation visible, trigger an update. The
    // documentation may decide it's no longer relevant and remove itself.
    if (that.documentation) {
      that.documentation.update();
    }

    // If there is currently no documentation rendered, attempt to display it.
    if (!that.documentation) {
      that.showArgumentDocumentation();
    }

    // Destroy the completion widget when we move the cursor away from the
    // current typing position. It's not relevant where it moved to since it'll
    // be invalid either way.
    if (closeOnCursor) {
      return that.removeWidget();
    }

    closeOnCursor = true;
  };

  this.cm.on('blur',           this.onBlur);
  this.cm.on('focus',          this.onFocus);
  this.cm.on('change',         this.onChange);
  this.cm.on('cursorActivity', this.onCursorActivity);
};

/**
 * Show a scrollable completion widget.
 */
Completion.prototype.showWidget = function () {
  var that = this;

  loadCompletion(this.cm, this.options, function (err, data) {
    that.removeWidget();

    return data && (that.widget = new Widget(that, data));
  });
};

/**
 * Removes the currently display widget.
 */
Completion.prototype.removeWidget = function () {
  return this.widget && this.widget.remove();
};

/**
 * Show an overlay tooltip with relevant documentation.
 */
Completion.prototype.showArgumentDocumentation = function () {
  var that = this;

  loadArguments(this.cm, this.options, function (err, data) {
    that.removeArgumentDocumentation();

    return data && (that.documentation = new ArgumentDocs(that, data));
  });
};

/**
 * Remove the overlay toolip.
 */
Completion.prototype.removeArgumentDocumentation = function () {
  return this.documentation && this.documentation.remove();
};

/**
 * Remove the completion widget.
 */
Completion.prototype.remove = function () {
  this.removeWidget();
  this.removeArgumentDocumentation();
  delete this.cm.state.completionActive;
  this.cm.off('blur',           this.onBlur);
  this.cm.off('focus',          this.onFocus);
  this.cm.off('change',         this.onChange);
  this.cm.off('cursorActivity', this.onCursorActivity);
};
