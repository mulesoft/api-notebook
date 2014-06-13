var _ = require('underscore');

/**
 * Convert a DOM element into a Backbone listener compatible object.
 *
 * @param  {Element} el
 * @return {Object}
 */
module.exports = function (el) {
  var listeners = [];

  var listener = {
    on: function (event, fn, context) {
      var cb = _.bind(fn, context);

      if (el) {
        el.addEventListener(event, cb, false);
      }

      listeners.push({
        event:   event,
        fn:      fn,
        cb:      cb,
        context: context
      });
    },
    once: function (event, fn, context) {
      var cb = function () {
        listener.off(event, cb, context);
        return fn.apply(context, arguments);
      };

      return listener.on(event, cb, context);
    },
    off: function (event, fn, context) {
      listeners = _.filter(listeners, function (listener) {
        var fns      = (!fn      || fn      === listener.fn);
        var events   = (!event   || event   === listener.event);
        var contexts = (!context || context === listener.context);

        // Check each of the arguments match and remove the listener.
        if (fns && events && contexts) {
          if (el) {
            el.removeEventListener(listener.event, listener.cb);
          }

          return true;
        }
      });
    }
  };

  return listener;
};
