var Backbone = require('backbone');
var bounce   = require('../lib/bounce');

/**
 * Configuration is a static backbone model that we listen to for changes in
 * application setup.
 *
 * @type {Object}
 */
var config = module.exports = new Backbone.Model({
  // The url is the embedding frame url.
  // The `url` is the parent window url, `fullUrl` is the url to the full-size
  // application (E.g. Anypoint Platform), `siteUrl` is the static sponsoring
  // site and `siteTitle` is a configurable name for the site host.
  url:       window.location.href,
  fullUrl:   process.env.application.url,
  siteUrl:   process.env.application.url,
  siteTitle: process.env.application.title,

  // Alter the visible UI.
  header:         true,
  footer:         false,
  sidebar:        true,
  savable:        true,
  embedded:       false,
  textReadOnly:   false,
  codeReadOnly:   false,
  authentication: true,

  // Set the UI text.
  authenticateText:   'Authenticate',
  unauthenticateText: 'Unauthenticate',

  // Content options.
  content:        '',
  defaultContent: ''
});

/**
 * Every time the style config changes, update the css.
 */
config.listenTo(config, 'change:style', (function () {
  var headEl  = document.head || document.getElementsByTagName('head')[0];
  var styleEl = headEl.appendChild(document.createElement('style'));

  return bounce(function () {
    styleEl.textContent = config.get('style');
  });
})());

/**
 * Listen for changes in the embedded config option and update conditional
 * styles.
 */
config.listenTo(config, 'change:embedded', bounce(function () {
  var isEmbedded      = !!config.get('embedded');
  var canAuthenticate = !!config.get('authentication');

  config.set({
    footer:       isEmbedded,
    header:       !isEmbedded,
    sidebar:      !isEmbedded && canAuthenticate,
    savable:      !isEmbedded && canAuthenticate,
    textReadOnly: !isEmbedded
  });

  var className = document.body.className.replace(' notebook-embedded', '');

  // If the notebook is embedded add the embedded class.
  if (isEmbedded) {
    document.body.className = className + ' notebook-embedded';
  }
}));

/**
 * Changes in authentication affect other parts of the application.
 */
config.listenTo(config, 'change:authentication', bounce(function () {
  var isEmbedded      = !!config.get('embedded');
  var canAuthenticate = !!config.get('authentication');

  config.set({
    sidebar: canAuthenticate && !isEmbedded,
    savable: canAuthenticate && !isEmbedded
  });
}));
