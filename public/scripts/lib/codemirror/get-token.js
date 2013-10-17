var _ = require('underscore');

/**
 * Returns the token at a given position. Augments the token object with
 * the token start position.
 *
 * @param  {CodeMirror}     cm
 * @param  {CodeMirror.Pos} pos
 * @return {Object}
 */
module.exports = function (cm, pos) {
  var token = cm.getTokenAt(pos);

  // Extend the base token with its position in the editor. This is essential to
  // recursively traverse DOM tokens.
  _.extend(token, {
    pos: _.extend({}, pos, {
      ch: token.start
    })
  });

  return token;
};
