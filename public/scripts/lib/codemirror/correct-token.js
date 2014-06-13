var _          = require('underscore');
var getToken   = require('./get-token');
var CodeMirror = require('codemirror');

/**
 * Grabs and corrects the grabbed token. Useful really only for sanitising a
 * `.` as a property. This helps when we need to do completion on the initial
 * `.` that is types.
 *
 * @param  {CodeMirror} cm
 * @param  {Object}     pos
 * @return {Object}
 */
module.exports = function (cm, pos) {
  var token = getToken(cm, pos);

  token.state = CodeMirror.innerMode(cm.getMode(), token.state).state;

  if (token.string === '.') {
    _.extend(token, {
      start:  token.end,
      end:    token.end,
      string: '',
      type:   'property'
    });

    // Increment token position.
    token.pos.ch = token.start;
  }

  return token;
};
