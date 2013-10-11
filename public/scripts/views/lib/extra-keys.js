var _ = require('underscore');

/**
 * Accepts an array of controls and returns a keymap for CodeMirror.
 *
 * @param  {Array}  controls
 * @return {Object}
 */
module.exports = function (controls) {
  var extraKeys = {};

  _.each(controls, function (control) {
    if (!control.keyMap) { return; }

    // Assign the key mapping to the extra keys object.
    extraKeys[control.keyMap] = function (cm) {
      cm.view[control.command]();
    };
  });

  return extraKeys;
};
