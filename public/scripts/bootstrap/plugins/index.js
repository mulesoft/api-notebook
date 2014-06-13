var _          = require('underscore');
var Backbone   = require('backbone');
var middleware = require('../../state/middleware');
var CodeMirror = require('codemirror');

require('./ui');
require('./ajax');
require('./sandbox');
require('./completion');
require('./result-cell');
require('./persistence');
require('./application');
require('./authentication');

// Trigger middleware for keydown events.
Backbone.$(document).on('keydown', function (e) {
  var keyName = CodeMirror.keyName(e, e.which === 16);

  middleware.trigger('keydown:' + keyName, {
    preventDefault: _.bind(e.preventDefault, e)
  });
});
