var Backbone = require('backbone');
var isMac = require('../lib/browser').mac;

var cmdKey = (isMac) ? "CMD" : "CTRL";
var ctrlKey = "CTRL";
var optKey = (isMac) ? "OPT" : "ALT";

/**
 * Format a string of keyboard commands.
 */
function join () {
  var args = Array.prototype.slice.call(arguments, 0);
  return args.join('-');
}

var CellControls = module.exports = Backbone.Model.extend({
  actions: [
    {
      name: 'moveUp',
      label: 'Move Up',
      keyCode: join(cmdKey, optKey, '↑')
    },
    {
      name: 'moveDown',
      label: 'Move Down',
      keyCode: join(cmdKey, optKey, '↓')
    },
    {
      name: 'switch',
      label: 'Switch Mode',
      keyCode: join(cmdKey, optKey, 'B')
    },
    {
      name: 'clone',
      label: 'Make Copy',
      keyCode: join(ctrlKey, optKey, 'C')
    },
    {
      name: 'remove',
      label: 'Delete',
      keyCode: join(cmdKey, 'Delete')
    },
    {
      name: 'appendNew',
      label: 'New Cell',
      keyCode: ''
    }
  ]
});
