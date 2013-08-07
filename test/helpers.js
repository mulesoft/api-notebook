var fakeKey = function (cm, code, props) {
  if (typeof code === 'string') {
    code = code.charCodeAt(0);
  }

  var e = {
    type: 'keydown',
    keyCode: code,
    preventDefault: function () {},
    stopPropagation: function() {}
  };

  if (props) {
    for (var n in props) {
      e[n] = props[n];
    }
  }

  cm.triggerOnKeyDown(e);
};

var simulateKey = function (editor, code, props) {
  if (typeof code === 'string') {
    code = code.charCodeAt(0);
  }

  props = props || {};

  var initKeyEvent = function (name) {
    var e = document.createEvent('KeyboardEvent');
    // Can't seem to get this working, so will have to work testing keyboard events
    e.initKeyboardEvent(name, true, true, window, props.ctrlKey, props.altKey, props.shiftKey, props.metaKey, code, 0);
    editor.getInputField().dispatchEvent(e);
  };

  initKeyEvent('keydown');
  initKeyEvent('keypress');
  initKeyEvent('keyup');
};
