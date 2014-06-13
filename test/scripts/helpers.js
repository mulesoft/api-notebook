/**
 * Extend a destination object with any number of properties and any number of
 * source object. This will override from left to right.
 *
 * @param  {Object} obj
 * @param  {Object} ...
 * @return {Object}
 */
window.extend = function (obj /*, ...source */) {
  var sources = Array.prototype.slice.call(arguments, 1);

  for (var i = 0; i < sources.length; i++) {
    for (var prop in sources[i]) {
      obj[prop] = sources[i][prop];
    }
  }

  return obj;
};

/**
 * Simulate a keypress event enough to test CodeMirror.
 *
 * @param  {CodeMirror}    editor
 * @param  {String|Number} code
 * @param  {Object}        props
 */
window.fakeKey = function (cm, code, props) {
  if (typeof code === 'string') {
    code = code.charCodeAt(0);
  }

  var e = extend({
    type: 'keydown',
    keyCode: code,
    preventDefault: function () {},
    stopPropagation: function () {}
  }, props);

  cm.triggerOnKeyDown(e);
};

/**
 * Test the autocompletion widget on a javascript editor instance.
 *
 * @param  {CodeMirror} editor
 * @param  {String}     value
 * @return {Array}
 */
window.testCompletion = function (editor, text, done) {
  // Listens to an event triggered by the widget
  editor.on('refreshCompletion', function refresh (cm, results) {
    editor.off('refreshCompletion', refresh);
    return done(App._.pluck(results, 'value'));
  });

  // Set the correct positioning
  editor.focus();
  editor.setValue(text);
  editor.setCursor(editor.lastLine(), Infinity);

  var cursor = editor.getCursor();

  // Trigger a fake change event to cause autocompletion to occur
  App.CodeMirror.Editor.signal(editor, 'change', editor, {
    origin: '+input',
    to:     extend({}, cursor),
    from:   extend({}, cursor, { ch: cursor.ch - 1 }),
    text:   [text.slice(-1)]
  });
};

/**
 * Simulate events using JavaScript.
 *
 * @return {Function}
 */
window.simulateEvent = (function () {
  var eventMatchers = {
    'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll|focusin|focusout)$/,
    'MouseEvents': /^(?:click|dblclick|mouse(?:enter|leave|down|up|over|move|out))$/,
    'KeyboardEvent': /^(?:key(?:down|press|up))$/
  };

  var defaultOptions = {
    pointerX:   0,
    pointerY:   0,
    button:     0,
    ctrlKey:    false,
    altKey:     false,
    shiftKey:   false,
    metaKey:    false,
    bubbles:    true,
    cancelable: true
  };

  return function (element, eventName, options) {
    options = extend({}, defaultOptions, options || {});

    var eventType = null;
    var oEvent;

    // Check the event name against the available types.
    for (var name in eventMatchers) {
      if (eventMatchers[name].test(eventName)) {
        eventType = name;
        break;
      }
    }

    if (!eventType) {
      throw new SyntaxError(
        'Only HTMLEvents, MouseEvents and KeyboardEvent interfaces are supported'
      );
    }

    if (document.createEvent) {
      oEvent = document.createEvent(eventType);

      if (eventType === 'HTMLEvents') {
        oEvent.initEvent(eventName, options.bubbles, options.cancelable);
      } else if (eventType === 'KeyboardEvent') {
        oEvent.initKeyboardEvent(
          eventName,
          options.bubbles,
          options.cancelable,
          document.defaultView,
          options.char,
          options.key,
          options.location,
          '', // Fix `modifiersListArg`
          options.repeat,
          options.locale
        );
      } else {
        oEvent.initMouseEvent(
          eventName,
          options.bubbles,
          options.cancelable,
          document.defaultView,
          options.button,
          options.pointerX,
          options.pointerY,
          options.pointerX,
          options.pointerY,
          options.ctrlKey,
          options.altKey,
          options.shiftKey,
          options.metaKey,
          options.button,
          element
        );
      }

      element.dispatchEvent(oEvent);
    } else {
      // Alias position options.
      options.clientX = options.pointerX;
      options.clientY = options.pointerY;

      oEvent = extend(document.createEventObject(), options);
      element.fireEvent('on' + eventName, oEvent);
    }

    return element;
  };
})();
