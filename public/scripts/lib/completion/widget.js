var _            = require('underscore');
var async        = require('async');
var Backbone     = require('backbone');
var Hints        = require('./hints');
var Ghost        = require('./ghost');
var middleware   = require('../../state/middleware');
var CodeMirror   = require('codemirror');
var correctToken = require('../codemirror/correct-token');

/**
 * Render a completion widget.
 *
 * @param  {Completion} completion
 * @param  {Object}     data
 * @return {Widget}
 */
var Widget = module.exports = function (completion, data) {
  var that = this;

  this.data       = data;
  this.completion = completion;

  CodeMirror.signal(completion.cm, 'startCompletion', completion.cm);

  completion.cm.addKeyMap(this.keyMap = {
    'Esc': function () { that.remove(); }
  });

  this.update();
};

/**
 * Extend the widget prototype with events.
 */
_.extend(Widget.prototype, Backbone.Events);

/**
 * Update the completion menu.
 */
Widget.prototype.update = function () {
  if (!this.data.results) { return; }

  var that    = this;
  var cm      = this.completion.cm;
  var results = this.data.results;

  this.removeHints();
  this.removeGhost();

  // Update the data positions.
  this.data.to    = cm.getCursor();
  this.data.token = correctToken(cm, this.data.to);

  async.filter(results, _.bind(this.filter, this), function (results) {
    that.removeHints();
    that.removeGhost();
    CodeMirror.signal(cm, 'refreshCompletion', cm, results);

    // Avoid rendering the hints menu when there is nothing to display.
    if (results.length < 2) {
      return results.length === 1 ? that.select(results[0]) : false;
    }

    that.hints = new Hints(that, results);

    that.select(results[0]);
    that.listenTo(that.hints, 'accept', that.accept, that);
    that.listenTo(that.hints, 'select', that.select, that);
  });
};

/**
 * Accepts a result as the completion result.
 *
 * @param {Object} result
 */
Widget.prototype.accept = function (result) {
  this.completion.cm.replaceRange(result.value, this.data.from, this.data.to);
  this.remove();
};

/**
 * Select a result from the hints menu to display.
 *
 * @param {Object} result
 */
Widget.prototype.select = function (result) {
  this.removeGhost();
  this.ghost = new Ghost(this, result);
  this.listenTo(this.ghost, 'accept', this.accept);
};

/**
 * Check whether a result should be filtered from the display.
 *
 * @param {String}   result
 * @param {Function} done
 */
Widget.prototype.filter = function (result, done) {
  middleware.trigger('completion:filter', {
    token:   this.data.token,
    result:  result,
    context: this.data.context
  }, function (err, filter) {
    if (err) {
      throw err;
    }

    return done(filter);
  });
};

/**
 * Remove the hints menu from the editor.
 */
Widget.prototype.removeHints = function () {
  if (this.hints) {
    this.stopListening(this.hints);
    this.hints.remove();
  }
};

/**
 * Remove the current ghost from the display.
 */
Widget.prototype.removeGhost = function () {
  if (this.ghost) {
    this.stopListening(this.ghost);
    this.ghost.remove();
  }
};

/**
 * Remove the current widget from the editor.
 */
Widget.prototype.remove = function () {
  this.removeHints();
  this.removeGhost();

  this.completion.cm.removeKeyMap(this.keyMap);

  delete this.keyMap;
  delete this.completion.widget;
  CodeMirror.signal(this.completion.cm, 'endCompletion', this.completion.cm);
};
