/**
 * Simulate a keypress event enough to test CodeMirror.
 *
 * @param  {CodeMirror}    editor
 * @param  {String|Number} code
 * @param  {Object}        props
 */
var fakeKey = function (cm, code, props) {
  if (typeof code === 'string') {
    code = code.charCodeAt(0);
  }

  var e = {
    type: 'keydown',
    keyCode: code,
    preventDefault: function () {},
    stopPropagation: function () {}
  };

  if (props) {
    for (var n in props) {
      e[n] = props[n];
    }
  }

  cm.triggerOnKeyDown(e);
};

/**
 * Test the autocompletion widget on a javascript editor instance.
 *
 * @param  {CodeMirror} editor
 * @param  {String}     value
 * @return {Array}
 */
var testCompletion = function (editor, text, done) {
  // Listens to an event triggered by the widget
  editor.on('refreshCompletion', function finish (cm, results) {
    editor.off('refreshCompletion', finish);
    return done(results);
  });
  // Set the correct positioning
  editor.focus();
  editor.setValue(text);
  editor.setCursor(editor.lastLine(), Infinity);
  // Trigger a fake change event to cause autocompletion to occur
  CodeMirror.signal(editor, 'change', editor, {
    origin: '+input',
    to:     editor.getCursor(),
    from:   editor.getCursor(),
    text:   [text.slice(-1)]
  });
};
