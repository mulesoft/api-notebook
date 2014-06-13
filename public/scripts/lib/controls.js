var _     = require('underscore');
var isMac = require('../lib/browser/about').mac;

exports.code   = [];
exports.text   = [];
exports.editor = [];

// Used for mapping key names to their fancier visual output.
var keyMap = {
  'Up':   '↑',
  'Down': '↓'
};

// Additional keymap for Mac users.
if (isMac) {
  keyMap.Alt = 'Opt';
}

/**
 * Join a number of keyboard arguments together.
 *
 * @param  {String} ...
 * @return {String}
 */
var join = function (keys) {
  return keys.join('-');
};

/**
 * Join a number of keyboard arguments together, passing it through a key
 * formatter for cleaner output.
 *
 * @param  {String} ...
 * @return {String}
 */
var format = function (keys) {
  return _.map(keys, function (key) {
    return (key in keyMap ? keyMap[key] : key);
  }).join('-');
};

/**
 * Augments a basic options map to be fully compatible with the output.
 *
 * @param  {Object} options
 * @return {Object}
 */
var define = function (options) {
  var defined = {};

  defined.label       = options.label;
  defined.shortcut    = options.shortcut;
  defined.command     = options.command;
  defined.description = options.description;

  if (options.keyMap) {
    defined.keyMap =  join(options.keyMap);
    defined.keyCode = format(options.keyMap);
  }

  return defined;
};

/**
 * Define a shortcut for editor cells.
 *
 * @param {Object} options
 */
var defineEditorShortcut = function (options) {
  exports.editor.push(define(options));
};

/**
 * Define a shortcut for code cells.
 *
 * @param {Object} options
 */
var defineCodeShortcut = function (options) {
  exports.code.push(define(options));
};

defineEditorShortcut({
  label: 'Move Up',
  command: 'moveUp',
  keyMap: [isMac ? 'Cmd' : 'Ctrl', 'Alt', 'Up'],
  description: 'Move cell up one position'
});

defineEditorShortcut({
  label: 'Move Down',
  command: 'moveDown',
  keyMap: [isMac ? 'Cmd' : 'Ctrl', 'Alt', 'Down'],
  description: 'Move cell down one position'
});

defineEditorShortcut({
  label: 'Switch Mode',
  command: 'switch',
  keyMap: [isMac ? 'Cmd' : 'Ctrl', 'Alt', 'B'],
  description: 'Change cell type (text/code)'
});

defineEditorShortcut({
  label: 'Make Copy',
  command: 'clone',
  keyMap: ['Ctrl', 'Alt', 'C'],
  description: 'Copy cell'
});

defineEditorShortcut({
  label: 'Delete',
  command: 'delete',
  keyMap: [isMac ? 'Cmd' : 'Ctrl', 'Backspace'],
  description: 'Delete cell'
});

defineEditorShortcut({
  label: 'New Cell',
  command: 'appendNew',
  keyMap: ['Ctrl', 'Alt', 'N'],
  description: 'Append a new code cell'
});

defineEditorShortcut({
  label: 'New Line Below',
  command: 'newLineBelow',
  keyMap: [isMac ? 'Cmd' : 'Ctrl', 'Enter'],
  description: 'Insert a new line below the current line'
});

defineEditorShortcut({
  label: 'Toggle Comment',
  command: 'toggleComment',
  keyMap: [isMac ? 'Cmd' : 'Ctrl', '/'],
  description: 'Toggle comments on the current line'
});

defineEditorShortcut({
  label: 'Browse Up',
  command: 'browseUp',
  keyMap: ['Up'],
  description: 'Natigate up to the previous line'
});

defineEditorShortcut({
  label: 'Browse Down',
  command: 'browseDown',
  keyMap: ['Down'],
  description: 'Navigate down to the next line'
});

defineCodeShortcut({
  label: 'Execute',
  command: 'execute',
  keyMap: ['Enter'],
  description: 'Execute the code cell contents'
});

defineCodeShortcut({
  label: 'New Line',
  command: 'newLine',
  keyMap: ['Shift', 'Enter'],
  description: 'Insert a new line'
});
