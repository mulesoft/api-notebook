var DOMBars = require('dombars/runtime');

/**
 * Register to DOMBars as the view helper.
 *
 * @param  {Backbone.View} view
 * @return {Node}
 */
DOMBars.registerHelper('view', function (view, options) {
  if (!view) { return document.createDocumentFragment(); }

  options.unsubscribe(function () {
    return view.remove();
  });

  return new DOMBars.SafeString(view.render().el);
});
