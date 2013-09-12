var _        = require('underscore');
var Backbone = require('backbone');

/**
 * Ajax middleware transportation protocol. Allows third-party to hook into the
 * middleware and augment properties such as the URL or request headers.
 *
 * @param  {Object} middleware
 */
module.exports = function (middleware) {
  /**
   * Send an ajax request and return the data back to the final listener.
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('ajax', function (data, next) {
    var request = _.extend({}, data, {
      processData: data.type === 'GET',
      success: function (content, status, xhr) {
        return next(null, _.extend({}, xhr, { content: content }));
      },
      error: function (xhr) {
        return next(new Error(xhr.statusText), _.extend({}, xhr));
      }
    });

    if (typeof data.data === 'object' && data.type === 'GET') {
      request.data = JSON.stringify(data.data);
    }

    // Use Backbone's ajax function to submit the request.
    data.xhr = Backbone.$.ajax(request);
  });
};
