var _            = require('underscore');
var Widget       = require('./widget');
var Pos          = CodeMirror.Pos;
var autocomplete = require('../codemirror/sandbox-completion');

var Completion = module.exports = function (cm, options) {
  var that          = this;
  var closeOnCursor = true;
  var closeOnBlur;

  this.cm      = cm;
  this.options = options || {};
  this.options.closeOn = this.options.closeOn || /[^$_a-zA-Z0-9]/;

  if (typeof this.options.filter !== 'function') {
    this.options.filter = function (string) {
      return string.substr(0, this.token.string.length) === this.token.string;
    };
  }

  this.cm.state.completionActive = this;

  this.onBlur = function () {
    closeOnBlur = setTimeout(function () { that.removeWidget(); }, 100);
  };

  this.onFocus = function () {
    clearTimeout(closeOnBlur);
  };

  this.onChange = function (cm, data) {
    closeOnCursor = false;

    // Only update the display when we are inserting or deleting characters
    if (!data.origin || data.origin.charAt(0) !== '+') {
      return that.removeWidget();
    }

    var closeOn = that.options.closeOn;
    // Upon text insertion, check against the data given to use to decide if we
    // need to create a new autocompletion widget.
    if (data.origin !== '+delete' && closeOn.test(data.text.join('\n'))) {
      that.removeWidget();
    }
    // Any deletions should check against the removed text to see if we need to
    // start a new autocompletion widget.
    if (data.origin === '+delete' && closeOn.test(data.removed.join('\n'))) {
      that.removeWidget();
    }

    var token = cm.getTokenAt(data.from);

    // If the previous token is whitespace, trigger a new autocompletion widget.
    if (/^ *$/.test(token.string)) {
      that.removeWidget();
    }

    if (that._completionActive) {
      that.refresh();
    } else {
      that.showWidget();
    }
  };

  this.onCursorActivity = function (cm) {
    if (closeOnCursor) { that.removeWidget(); }

    closeOnCursor = true;
  };

  this.cm.on('blur',           this.onBlur);
  this.cm.on('focus',          this.onFocus);
  this.cm.on('change',         this.onChange);
  this.cm.on('cursorActivity', this.onCursorActivity);
};

Completion.prototype.remove = function () {
  this.removeWidget();
  delete this.cm.state.completionActive;
  this.cm.off('blur',           this.onBlur);
  this.cm.off('focus',          this.onFocus);
  this.cm.off('change',         this.onChange);
  this.cm.off('cursorActivity', this.onCursorActivity);
};

Completion.prototype.refresh = function (done) {
  if (this.widget) {
    return this.widget.refresh(done);
  }

  return done && done();
};

Completion.prototype.showWidget = function () {
  this.removeWidget();
  this._completionActive = true;
  autocomplete(this.cm, this.options, _.bind(function (err, data) {
    if (!this.widget && data) {
      this.widget = new Widget(this, data);
    }
  }, this));
};

Completion.prototype.removeWidget = function () {
  this._completionActive = false;
  if (this.widget) { this.widget.remove(); }
};
