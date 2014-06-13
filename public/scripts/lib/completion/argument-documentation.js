var _            = require('underscore');
var getToken     = require('../codemirror/get-token');
var tokenHelpers = require('../codemirror/token-helpers');
var messages     = require('../../state/messages');
var formatDocs   = require('./format-documentation');

/**
 * An map of possible function types.
 *
 * @type {Object}
 */
var FUNCTION_TYPES = {
  variable: true,
  property: true
};

/**
 * Check if a token is before another token.
 *
 * @param  {Object}  pos
 * @param  {Object}  before
 * @return {Boolean}
 */
var isTokenBefore = function (pos, before) {
  if (pos.line < before.line) {
    return true;
  }

  if (pos.line === before.line && pos.ch < before.ch) {
    return true;
  }

  return false;
};

/**
 * Render a new argument documentation.
 *
 * @param  {Completion}   completion
 * @param  {Object}       data
 * @return {ArgumentDocs}
 */
var ArgumentDocs = module.exports = function (completion, data) {
  this.data       = data;
  this.completion = completion;

  var params        = this.params = [];
  var cm            = this.completion.cm;
  var curLine       = this.curLine = cm.getCursor().line;
  var documentation = this.documentation = document.createElement('div');
  var type          = data.description['!type'];
  var result        = data.description['!return'];
  var title         = documentation.appendChild(document.createElement('div'));

  title.className         = 'CodeMirror-documentation-title';
  documentation.className = 'CodeMirror-documentation';

  // Get the function name as the variable preceding the opening bracket.
  var fnName = this.fnName = tokenHelpers.eatEmpty(
    cm, getToken(cm, this.data.from)
  ).string;

  // Append a text node with the correct token string.
  title.appendChild(document.createTextNode(fnName + '('));

  _.each(/^fn\((.*)\)/.exec(type)[1].split(', '), function (arg, index, args) {
    var param = document.createElement('span');
    param.appendChild(document.createTextNode(arg));

    params.push(param);
    title.appendChild(param);

    if (index < args.length - 1) {
      title.appendChild(document.createTextNode(', '));
    }
  });

  title.appendChild(document.createTextNode(')'));

  if (result) {
    title.appendChild(document.createTextNode(' -> ' + result));
  }

  // Append a static container for documentation.
  this.description = documentation.appendChild(document.createElement('div'));
  this.description.className = 'CodeMirror-documentation-description';

  // Attach the widget below the current line.
  this.widget = cm.addLineWidget(curLine, documentation);

  this.update();
};

/**
 * Show the documentation for a specific argument.
 *
 * @param {Number} index
 */
ArgumentDocs.prototype.select = function (index) {
  var prefix   = 'CodeMirror-documentation-description-';
  var argument = this.data.description['!args'][index];
  var cm       = this.completion.cm;
  var curLine  = cm.getCursor().line;

  // Make it follow the selected line.
  if (curLine !== this.curLine) {
    this.removeWidget();
    this.widget  = cm.addLineWidget(curLine, this.documentation);
    this.curLine = curLine;
  }

  // Avoiding reselecting the same argument.
  if (this.currentArgument === index) { return; }

  // Set the correct argument to active.
  _.each(this.params, function (param, position) {
    param.classList[index === position ? 'add' : 'remove'](
      'CodeMirror-documentation-argument-active'
    );
  });

  // Empty the description element before appending new docs.
  this.description.innerHTML = '';
  this.currentArgument       = index;

  if (!argument) {
    this.widget.changed();
    return messages.trigger('resize');
  }

  // Map the documentation to the description rendering.
  var docs = _.object(_.map(formatDocs(argument), function (docs, type) {
    if (type === 'url') {
      docs = '<a href="' + docs + '" target="_blank">Read more</a>';
    }

    return [type, '<div class="' + prefix + type + '">' + docs + '</div>'];
  }));

  this.description.innerHTML += docs.type || '';
  this.description.innerHTML += docs.doc  || '';
  this.description.innerHTML += docs.url  || '';

  this.widget.changed();
  return messages.trigger('resize');
};

/**
 * Update the argument documentation position.
 */
ArgumentDocs.prototype.update = function () {
  var cm = this.completion.cm;

  // Remove the documentation when multiple characters are selected.
  if (cm.doc.somethingSelected()) {
    return this.remove();
  }

  var cur        = this.data.to = cm.getCursor();
  var from       = this.data.from;
  var token      = getToken(cm, cur);
  var index      = 0;
  var curCount   = 0;
  var roundLevel = 0;
  var curlyLevel = 0;

  // Remove the documentation if we are stating before the opening bracket.
  if (isTokenBefore(token.pos, from)) {
    return this.remove();
  }

  // Iterate over every new block and track our argument index. If we hit
  // a new function inside the current arguments, remove the current widget.
  while (!isTokenBefore(token.pos, from)) {
    if (token.type === null) {
      if (token.string === '(') {
        roundLevel++;

        // If we have a resolved round level, it would have just completed
        // bracket notation which can contain commas.
        if (roundLevel > -1) {
          // Make sure we don't reset on the real opening bracket.
          if (!(token.pos.ch === from.ch && token.pos.line === from.line)) {
            index -= curCount;
            curCount = 0;
          }
        }

        // Check if the previous token is a function type.
        var prev  = tokenHelpers.eatEmptyAndMove(cm, token);
        var match = token.start === from.ch && token.pos.line === from.line;

        if (roundLevel > 0 && FUNCTION_TYPES[prev.type] && !match) {
          return this.remove();
        }
      } else if (token.string === ')') {
        roundLevel--;

        if (roundLevel < -1) {
          index -= curCount;
          curCount = 0;
        } else if (roundLevel === -1) {
          curCount = 0;
        }
      } else if (token.string === '{') {
        curlyLevel++;

        if (curlyLevel > -1) {
          index -= curCount;
          curCount = 0;
        }
      } else if (token.string === '}') {
        curlyLevel--;

        if (curlyLevel < -1) {
          index -= curCount;
          curCount = 0;
        } else if (curlyLevel === -1) {
          curCount = 0;
        }
      } else if (token.string === ',') {
        index++;
        curCount++;
      }
    }

    token = tokenHelpers.eatEmptyAndMove(cm, token);
  }

  // If there is no block level, we are no longer inside the arguments.
  if (roundLevel < 1) {
    return this.remove();
  }

  this.select(index);
};

/**
 * Remove the widget from the editor.
 */
ArgumentDocs.prototype.removeWidget = function () {
  if (this.widget) {
    this.widget.clear();
    messages.trigger('resize');
    delete this.widget;
  }
};

/**
 * Remove the argument documentation from the editor.
 */
ArgumentDocs.prototype.remove = function () {
  this.removeWidget();
  delete this.documentation;
  delete this.completion.documentation;
};
