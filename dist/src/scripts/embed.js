var url     = require('url');
var css     = require('css-component');
var each    = require('foreach');
// var Kamino  = require('kamino');
var __slice = Array.prototype.slice;

/**
 * Extend any object with the properties from other objects, overriding of left
 * to right.
 *
 * @param  {Object} obj Root object to copy properties to.
 * @param  {Object} ... Any number of source objects that properties will be
 *                      copied from.
 * @return {Object}
 */
var extend = function (obj /*, ...source */) {
  each(__slice.call(arguments, 1), function (source) {
    for (var prop in source) {
      if (Object.prototype.hasOwnProperty.call(source, prop)) {
        obj[prop] = source[prop];
      }
    }
  });

  return obj;
};

/**
 * Getting all the data atrributes of an element. Works cross-browser.
 *
 * @param  {Element} el
 * @return {Object}
 */
var getDataAttributes = function (el) {
  var obj  = {};

  if (el.dataset) {
    return extend(obj, el.dataset);
  }

  var upperCase = function (_, $0) { return $0.toUpperCase(); };

  var attrs = el.attributes;
  for (var i = 0, l = attrs.length; i < l; i++) {
    var attr = attrs.item(i);
    if (attr.nodeName.substr(0, 5) === 'data-') {
      var name = attr.nodeName.substr(5).replace(/\-(\w)/, upperCase);

      obj[name] = attr.nodeValue;
    }
  }

  return obj;
};

/**
 * Copy of all the default options for a new Notebook instance.
 *
 * @type {Object}
 */
var defaultOptions = {
  // Location to load the notebook from.
  url:     url.resolve(process.env.application.url, 'embed.html'),
  // Initial id to pull content from.
  id:      null,
  // Fallback content in case of no id.
  content: '',
  // Set styles on the iframe.
  style:   {},
  // Alias objects into the frame once available.
  alias:   {}
};

/**
 * Copy of the default iframe style options.
 *
 * @type {Object}
 */
var defaultStyles = {
  width:       '100%',
  border:      'none',
  display:     'block',
  marginLeft:  'auto',
  marginRight: 'auto',
  padding:     '0',
  overflow:    'hidden'
};

/**
 * Creates an embeddable version of the notebook for general consumption.
 *
 * @param  {(Element|Function)} el
 * @param  {Object}             options
 * @return {Notebook}
 */
var Notebook = module.exports = function (el, options, styles) {
  if (!(this instanceof Notebook)) {
    return new Notebook(el, options, styles);
  }

  var notebook = this;
  var notebookStyles = extend({}, defaultStyles, styles);
  var notebookOptions = extend({}, defaultOptions, options);

  // Resolve the URL relative to the current window.
  notebookOptions.url = url.resolve(window.location.href, notebookOptions.url);

  notebook._makeFrame(el, notebookOptions);
  notebook._styleFrame(notebookStyles);

  // Listen to the ready event and set a flag for future ready functions.
  notebook.once('ready', function () {
    var notebook = this;

    // Set a "private" ready flag to ensure that any future register ready
    // functions are executed immediately.
    this._ready = true;

    // Iterate over the currently registered "ready" functions.
    if (this._readyFunctions) {
      each(this._readyFunctions, function (fn) {
        fn.call(notebook);
      });
    }

    // Delete the ready functions array since the functions shouldn't be used
    // anymore.
    delete this._readyFunctions;
  });
};

/**
 * Keep track of all created notebooks and allow configuration after creation.
 *
 * @type {Array}
 */
Notebook.instances = [];

/**
 * Keep track of all registered subscriptions and unsubscriptions.
 *
 * @type {Array}
 */
Notebook.subscriptions   = [];
Notebook.unsubscriptions = [];

/**
 * Pass a subscription method to every notebook. It will be called for all
 * notebook instances, new and old.
 *
 * @param {Function} fn
 */
Notebook.subscribe = function (fn) {
  Notebook.subscriptions.push(fn);

  each(Notebook.instances, fn);
};

/**
 * Pass an unsubscribe method to every notebook instance for removal.
 *
 * @param {Function} fn
 */
Notebook.unsubscribe = function (fn) {
  Notebook.unsubscriptions.push(fn);
};

/**
 * Generate an iframe to house the embeddable widget and append to the
 * designated element in the DOM.
 *
 * @param  {Element|Function} el
 * @return {Notebook}
 */
Notebook.prototype._makeFrame = function (el, options) {
  var notebook = this;
  var frame    = this.el = document.createElement('iframe');

  // Configure base frame options.
  frame.src       = options.url;
  frame.className = options.className || '';
  frame.scrolling = 'no';

  // Alias access to the current instance.
  frame.Notebook  = this;

  // Extend basic configuration options.
  options.config = extend({
    id:       options.id,
    url:      window.location.href,
    embedded: true,
    content:  options.content
  }, options.config);

  /**
   * Keep config options in sync.
   *
   * @param  {String} name
   * @param  {*}      value
   */
  this.on('config', function (name, value) {
    options.config[name] = value;
  });

  // When the app is ready to receive events, send configuration data and let
  // the frame know that we are ready to execute.
  this.once('ready', function () {
    this.trigger('ready', options);
  });

  this.once('rendered', function () {
    Notebook.instances.push(notebook);

    each(Notebook.subscriptions, function (fn) {
      fn(notebook);
    });
  });

  // When a new height comes through, update the iframe height. Use the inline
  // height tag since css should take a higher precendence (which allows simple
  // height overrides to work alongside this).
  this.on('height', function (height) {
    this.el.height = height;
  });

  // Handle redirects from the child by executing in the parent frame.
  this.on('redirect', function (location) {
    window.location = location;
  });

  // Set up a single message listener that will trigger events from the frame
  global.addEventListener('message', this._messageListener = function (e) {
    if (e.source !== frame.contentWindow) { return; }

    notebook._frameEvent = e;
    notebook.trigger.apply(notebook, JSON.parse(e.data));
  }, false);

  if (typeof el.appendChild === 'function') {
    el.appendChild(frame);
  } else {
    el(frame);
  }

  this.window  = frame.contentWindow;
  this.options = options;

  return this;
};

/**
 * Sets the inline styles of the frame.
 *
 * @param  {Object}   style
 * @return {Notebook}
 */
Notebook.prototype._styleFrame = function (styles) {
  css(this.el, styles);
  return this;
};

/**
 * Evaluate text in the context of the notebook frame.
 *
 * @param {String}   evil
 * @param {Function} done
 */
Notebook.prototype.exec = function (evil, done) {
  this.once('exec', function (result) {
    return done && done(result);
  });

  this.trigger('exec', evil);
};


/**
 * Returns a variable from the embedded page.
 *
 * @param {String}   key
 * @param {Function} done
 */
Notebook.prototype.getVariable = function (key, done) {
  this.exec(key, done);
};

/**
 * Removes the frame from the DOM.
 *
 * @return {Notebook}
 */
Notebook.prototype._removeFrame = function () {
  global.removeEventListener('message', this._messageListener);
  this.el.parentNode.removeChild(this.el);
  delete this.el;

  return this;
};

/**
 * Removes any notebook associated data from the embedding frame.
 *
 * @return {Notebook}
 */
Notebook.prototype.remove = function () {
  for (var i = 0; i < Notebook.instances.length; i++) {
    if (Notebook.instances[i] === this) {
      /* jshint -W083 */
      each(Notebook.unsubscriptions, function (fn) {
        fn(Notebook.instances[i]);
      });

      i--;
      Notebook.instances.pop();
    }
  }

  this.off();

  return this._removeFrame();
};

/**
 * Listen to events triggered by the frame.
 *
 * @param  {String}   name
 * @param  {Function} fn
 * @return {Notebook}
 */
Notebook.prototype.on = function (name, fn) {
  this._events = this._events || {};
  var events = (this._events[name] = this._events[name] || []);
  events.push(fn);

  return this;
};

/**
 * Listen to an event being triggered by the frame once.
 *
 * @param  {String}   name
 * @param  {Function} fn
 * @return {Notebook}
 */
Notebook.prototype.once = function (name, fn) {
  var that = this;
  return this.on(name, function cb () {
    that.off(name, cb);
    fn.apply(this, arguments);
    fn = null;
  });
};

/**
 * Remove an event listener from the frame.
 *
 * @param  {String}   name
 * @param  {Function} [fn]
 * @return {Notebook}
 */
Notebook.prototype.off = function (name, fn) {
  if (!this._events || !this._events[name]) { return this; }

  if (!fn) {
    if (!name) {
      delete this._events;
    } else {
      delete this._events[name];
    }

    return this;
  }

  var events = this._events[name];
  for (var i = 0; i < events.length; i++) {
    if (events[i] === fn) {
      events.splice(i, 1);
      i--;
    }
  }

  if (!events.length) { delete this._events[name]; }

  return this;
};

/**
 * Trigger an event on the frame. Read: Sends an event to the frames postMessage
 * handler.
 *
 * @param  {String}   name
 * @param  {*}        ...  Any additional data you wish the send with the event
 * @return {Notebook}
 */
Notebook.prototype.trigger = function (name /*, ..args */) {
  var that = this;
  var args;

  if (this._frameEvent) {
    delete that._frameEvent;
    args = __slice.call(arguments, 1);
    if (this._events && this._events[name]) {
      // Slice a copy of the events since we might be removing an event from
      // within an event callback. In which case it would break the loop.
      each(this._events[name].slice(), function (fn) {
        fn.apply(that, args);
      });
    }
    return this;
  }

  args = __slice.call(arguments, 0);
  this.el.contentWindow.postMessage(JSON.stringify(args), this.options.url);
  return this;
};

/**
 * Shorthand for setting a config option.
 */
Notebook.prototype.config = function () {
  this.trigger.apply(this, ['config'].concat(__slice.call(arguments)));
};

/**
 * Shorthand for passing messages to the application.
 */
Notebook.prototype.message = function () {
  this.trigger.apply(this, ['message'].concat(__slice.call(arguments)));
};

/**
 * Pass meta data for the current notebook.
 */
Notebook.prototype.meta = function () {
  this.trigger.apply(this, ['meta'].concat(__slice.call(arguments)));
};

/**
 * Refresh the iframe.
 */
Notebook.prototype.refresh = function () {
  this.message('refresh');
};

/**
 * Execute a function when the notebook is ready to be interacted with.
 *
 * @param {Function} fn
 */
Notebook.prototype.ready = function (fn) {
  if (this._ready) {
    return fn.call(this);
  }

  (this._readyFunctions || (this._readyFunctions = [])).push(fn);
};

/**
 * Attempts to automatically create the initial notebook by scanning for the
 * correct script tag and using the data from it to generate the notebook.
 *
 * @param {NodeList} scripts
 */
(function (scripts) {
  var script;

  for (var i = 0, l = scripts.length; i < l; i++) {
    // Allows the script to be loaded asynchronously if we provide this
    // attribute with the script tag.
    if (scripts[i].hasAttribute('data-notebook')) {
      script = scripts[i];
      break;
    }
  }

  if (!script) {
    return;
  }

  // By default we'll create the notebook in the same element as the script.
  var el = script.parentNode;

  // Allow the notebook attribute to point to another element.
  if (script.getAttribute('data-notebook')) {
    el = document.getElementById(script.getAttribute('data-notebook'));
  }

  // Remove the `data-notebook` attribute for future loads.
  script.removeAttribute('data-notebook');

  // Create the notebook instance and append.
  return new Notebook(el, getDataAttributes(script));
})(document.getElementsByTagName('script'));
