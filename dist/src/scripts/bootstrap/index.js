// Shim Backbone with the functionality from Backbone.native
var Backbone = require('backbone');
Backbone.$   = require('backbone.native');

// ES6 Feature Shim.
require('es6-collections');

// Require all CodeMirror functionality.
require('codemirror/addon/mode/overlay');
require('codemirror/addon/comment/comment');
require('codemirror/mode/gfm/gfm');
require('codemirror/mode/markdown/markdown');
require('codemirror/mode/css/css');
require('codemirror/mode/xml/xml');
require('codemirror/mode/clike/clike');
require('codemirror/mode/htmlmixed/htmlmixed');
require('codemirror/mode/javascript/javascript');

// Bootstrap core functionality.
require('./dom');
require('./plugins');
