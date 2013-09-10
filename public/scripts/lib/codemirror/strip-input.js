var _    = require('underscore');
var trim = require('trim');

var stripInput = function (prevPosition, cm, string) {
  var endPosition = { ch: Infinity, line: Infinity };
  var text        = cm.doc.getRange(prevPosition, endPosition);
  // Remove everything after the position
  cm.doc.replaceRange('', prevPosition, endPosition);
  // Trim and/or remove the last line if it is now empty
  var lastLine = trim.right(cm.doc.getLine(cm.doc.lastLine()));
  if (lastLine) {
    cm.doc.setLine(cm.doc.lastLine(), lastLine);
  } else {
    cm.doc.removeLine(cm.doc.lastLine());
  }
  return trim.left(text.substr(string.length));
};

var handleSetValue = function (string, cm, event) {
  var index, line;

  for (var i = 0; i < event.text.length; i++) {
    index = event.text[i].indexOf(string);
    // Break the loop through all the data if we found what we were looking for
    if (index > -1) {
      line = i + event.from.line;
      break;
    }
  }

  if (isNaN(line)) { return false; }

  return stripInput({
    ch: (line === event.from.line ? event.from.ch + index : index),
    line: line
  }, cm, string);
};

var handleInput = function (string, cm, event) {
  if (event.text[0] !== string[string.length - 1] || event.to.ch < 1) {
    return false;
  }

  var prevPosition = _.defaults({
    ch: event.from.ch - string.length + 1
  }, event.from);

  var prevChars = cm.doc.getRange(prevPosition, event.from);

  if (prevChars !== string.slice(0, -1)) { return false; }

  return stripInput(prevPosition, cm, string);
};

var handlePaste = function (string, cm, event) {
  // Try and find if the first character of the input is part of the string
  var index = string.indexOf(event.text[0].charAt(0));

  if (index < 0) { return handleSetValue(string, cm, event); }

  var prevPosition = _.defaults({
    ch: event.from.ch - index
  }, event.from);

  var nextPosition = _.defaults({
    ch: event.from.ch - index + string.length
  }, event.from);

  var prevChars = cm.doc.getRange(prevPosition, nextPosition);

  if (prevChars !== string) { return handleSetValue(string, cm, event); }

  return stripInput(prevPosition, cm, string);
};

// Quickly checks if a certain string has been inserted. If it hasn't it will
// immediately return `false`. Otherwise, it will strip all the trailing text
// from the CodeMirror instance and return it instead. Oddly enough, I'm
// including an `includeChars` flag for the case when a text block has already
// been closed, but we are trying to close it again.
module.exports = function (string, cm, event) {
  // setValue events need to be managed and parsed manually
  if (event.origin === 'setValue') { return handleSetValue(string, cm, event); }
  // Paste events are slightly more complicated since part of the existing text
  // could be in the paste and when joined with the existing input, it could
  // create the target string
  if (event.origin === 'paste') { return handlePaste(string, cm, event); }
  // Handle input events can be done more efficiently than with paste
  if (event.origin === '+input') { return handleInput(string, cm, event); }
  // Finally just return false if it's none of the above
  return false;
};
