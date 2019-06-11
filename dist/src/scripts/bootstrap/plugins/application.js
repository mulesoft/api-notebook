/* global App */
var _           = require('underscore');
var async       = require('async');
var loadScript  = require('../../lib/browser/load-script');
var state       = require('../../state/state');
var config      = require('../../state/config');
var messages    = require('../../state/messages');
var middleware  = require('../../state/middleware');
var persistence = require('../../state/persistence');
var PostMessage = require('../../lib/post-message');

/**
 * Alias any optional global variables passed in.
 *
 * @param {Object}   options
 * @param {Function} next
 */
middleware.register('application:start', function (options, next) {
  _.each(options.alias || {}, function (value, key) {
    window[key] = value;
  });

  return next();
});

/**
 * Execute arbitrary passed in scripts.
 *
 * @param {Object}   options
 * @param {Function} next
 */
middleware.register('application:start', function (options, next) {
  try {
    /* jshint evil: true */
    window.eval(options.exec || '');
  } catch (e) {
    return next(e);
  }

  return next();
});

/**
 * Load all injected script options.
 *
 * @param {Object}   options
 * @param {Function} next
 */
middleware.register('application:start', function (options, next) {
  return async.each(options.inject || [], loadScript, next);
});

/**
 * Update the config object with the optional passed in config.
 *
 * @param {Object}   options
 * @param {Function} next
 */
middleware.register('application:start', function (options, next) {
  middleware.trigger(
    'application:config',
    _.extend({}, options.config),
    function (err, options) {
      if (err) {
        return next(err);
      }

      // Set certain properties before others to avoid ordering issues.
      config.set('embedded',       !!options.embedded);
      config.set('authentication', options.authentication !== false);
      config.set(_.omit(options, ['embedded', 'authentication']));

      return next();
    }
  );
});

/**
 * The first middleware for application start has to be the parent frame set up.
 *
 * @param {Object}   options
 * @param {Function} next
 */
middleware.register('application:start', function (options, next) {
  // Skip middleware execution if we are the parent frame.
  if (window === window.parent) { return next(); }

  var postMessage = App.postMessage = new PostMessage(window.parent);

  /**
   * Listen for changes in the document height and resize the parent frame.
   */
  state.on('change:documentHeight', function (_, height) {
    postMessage.trigger('height', height);
  });

  /**
   * Listen for any changes to the configuration url and update the base
   * element. This is required for correctly opening links in the parent frame.
   */
  postMessage.listenTo(config, 'change:url', (function () {
    var headEl = document.head || document.getElementsByTagName('head')[0];
    var baseEl = document.getElementsByTagName('base')[0];

    return function (_, url) {
      if (baseEl) { baseEl.parentNode.removeChild(baseEl); }

      baseEl = document.createElement('base');
      baseEl.setAttribute('href',   url);
      baseEl.setAttribute('target', '_parent');
      headEl.appendChild(baseEl);
    };
  })());

  /**
   * Listen to the parent frame to be ready and pass its config options.
   */
  postMessage.on('ready', function (parentOptions) {
    _.extend(options, parentOptions);
    return next();
  });

  /**
   * Run arbitrary code inside the frame by passed an evil string in.
   */
  postMessage.on('exec', function (evil) {
    /* jshint evil: true */
    postMessage.trigger('exec', window.eval(evil));
  });

  /**
   * Listen to any configuration changes.
   */
  postMessage.on('config', function () {
    config.set.apply(config, arguments);
  });

  /**
   * Listen for meta data changes.
   */
  postMessage.on('meta', function () {
    var meta = persistence.get('notebook').get('meta');

    meta.set.apply(meta, arguments);
  });

  /**
   * Trigger cross-frame messages easily.
   */
  postMessage.on('message', function () {
    messages.trigger.apply(messages, arguments);
  });

  /**
   * Trigger changes on the config object to the parent frame. This is
   * incredibly useful for helping the parent frame with integration.
   */
  postMessage.listenTo(config, 'all', function (event) {
    if (event.substr(0, 7) !== 'change:') { return; }

    var name  = event.substr(7);
    var value = config.get(name);

    postMessage.trigger('config', name, value);
  });

  /**
   * Trigger a ready event to the parent frame. This allows the frame to now
   * send all its config options without risk of losing data.
   */
  postMessage.trigger('ready');
});

/**
 * Check whether the browser supports core JavaScript ES5 APIs needed for the
 * notebook to function.
 *
 * @param {Object}   app
 * @param {Function} next
 */
middleware.register('application:start', function (app, next) {
  if (
    window.addEventListener && Object.getOwnPropertyNames &&
    Object.getPrototypeOf && Object.getOwnPropertyDescriptor
  ) {
    return next();
  }

  middleware.trigger('ui:modal', {
    title: 'Unsupported Browser',
    content: '<p>Your browser is out of date. Please consider upgrading to ' +
      'get the full experience of this application. <a target="_blank" ' +
      'href="http://browsehappy.com/">You can find a list of up-to-date ' +
      'browsers here.</a></p><div class="text-center">' +
      '<button class="btn btn-primary" data-dismiss>Close</button></div>'
  }, next);
});
