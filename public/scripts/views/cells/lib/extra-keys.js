var _ = require('underscore');

/**
 * Accepts an array of controls and an array of controls to ignore, and returns
 * a keymap that is accepted by CodeMirror.
 *
 * @param  {Array}  controls
 * @param  {Array}  ignore
 * @return {Object}
 */
module.exports = function (controls, ignore) {
  var extraKeys = {};

  _.each(controls, function (control) {
    if (!control.keyMap) { return; }
    // Assign the key mapping to the extra keys object
    extraKeys[control.keyMap] = function (cm) {
      cm.view[control.command]();
    };
  });

  return extraKeys;
};
