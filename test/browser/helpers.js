/**
 * Extend a destination object with any number of properties and any number of
 * source object. This will override from left to right.
 *
 * @param  {Object} obj
 * @param  {Object} ...
 * @return {Object}
 */
var extend = function (obj /*, ...source */) {
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
var fakeKey = function (cm, code, props) {
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

/**
 * Simulate events using JavaScript.
 *
 * @return {Function}
 */
var simulateEvent = (function () {
  var eventMatchers = {
    'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll|focusin|focusout)$/,
    'MouseEvents': /^(?:click|dblclick|mouse(?:down|up|over|move|out))$/
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
        'Only HTMLEvents and MouseEvents interfaces are supported'
      );
    }

    if (document.createEvent) {
      oEvent = document.createEvent(eventType);

      if (eventType === 'HTMLEvents') {
        oEvent.initEvent(eventName, options.bubbles, options.cancelable);
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
