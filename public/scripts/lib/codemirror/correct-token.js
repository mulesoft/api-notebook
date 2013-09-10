module.exports = function (cm, pos) {
  var token = cm.getTokenAt(pos);

  token.state = CodeMirror.innerMode(cm.getMode(), token.state).state;

  if (token.string === '.') {
    token = {
      start:  token.end,
      end:    token.end,
      string: '',
      type:   'property',
      state:  token.state
    };
  }

  return token;
};
