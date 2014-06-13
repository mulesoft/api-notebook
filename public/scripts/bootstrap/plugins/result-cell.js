var _              = require('underscore');
var typeOf         = require('../../lib/type');
var Inspector      = require('../../views/inspector');
var ErrorInspector = require('../../views/error-inspector');
var middleware     = require('../../state/middleware');

/**
 * Render the result cell contents.
 *
 * @param  {Object}   data
 * @param  {Function} next
 * @param  {Function} done
 */
middleware.register('result:render', function (data, next, done) {
  var options = {
    window:  data.window,
    inspect: data.inspect
  };

  var inspector;

  if (!data.isError) {
    inspector = new Inspector(options);
  } else {
    inspector = new ErrorInspector(options);
  }

  inspector.render().appendTo(data.el);

  // Opens the inspector automatically when the type is an object.
  var type = typeOf(data.inspect);

  if (type === 'object' || type === 'array') {
    inspector.open();
  }

  return done(null, _.bind(inspector.remove, inspector));
});
