var _         = require('underscore');
var DOMBars   = require('dombars/runtime');
var hbsIf     = DOMBars.helpers.if;
var hbsUnless = DOMBars.helpers.unless;

/**
 * Overload the Handlebars if helper to accept multiple arguments.
 */
DOMBars.registerHelper('if', function (/* ...args, options */) {
  var args    = Array.prototype.slice.call(arguments, 0, -1);
  var options = arguments[arguments.length - 1];
  var check   = _.every(args, function (value) { return value; });

  return hbsIf.call(this, check, options);
});

/**
 * Overload the unless helper to accept multiple arguments.
 */
DOMBars.registerHelper('unless', function (/* ...args, options */) {
  var args    = Array.prototype.slice.call(arguments, 0, -1);
  var options = arguments[arguments.length - 1];
  var check   = _.every(args, function (value) { return value; });

  return hbsUnless.call(this, check, options);
});

/**
 * Create an `any` helper that will run any time any of the arguments are true.
 */
DOMBars.registerHelper('any', function (/* ...args, options */) {
  var args    = Array.prototype.slice.call(arguments, 0, -1);
  var options = arguments[arguments.length - 1];
  var check   = _.any(args, function (value) { return value; });

  return hbsIf.call(this, check, options);
});
