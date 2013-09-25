var _   = require('underscore');
var qs  = require('querystring');
var url = require('url');

/**
 * Register oauth2 based middleware. Handles oauth2 implicit auth flow, and the
 * normal oauth2 authentication flow when using the notebook proxy server.
 *
 * @param {Object} middleware
 */
module.exports = function (middleware) {
  /**
   * Trigger authentication via oauth2 in the browser. Valid data properties:
   *
   *   `authorizationUrl` - "https://www.example.com/oauth2/authorize"
   *   `tokenUrl`         - "https://www.example.com/oauth2/token"
   *   `clientId`         - EXAMPLE_CLIENT_ID
   *   `clientSecret`     - EXAMPLE_CLIENT_SECRET *NOT RECOMMENDED*
   *   `scope`            - ["user", "read", "write"]
   *
   * @param  {Object}   data
   * @param  {Function} next
   */
  middleware.core('authenticate:oauth2', function (data, next) {
    var width  = 500;
    var height = 350;
    var left   = (window.screen.availWidth - width) / 2;
    var state  = ('' + Math.random()).substr(2);

    // Stringify the query string data.
    var query  = qs.stringify({
      'state':        state,
      'scope':        _.toArray(data.scope).join(','),
      'client_id':    data.clientId,
      'redirect_uri': url.resolve(
        global.location, '/authentication/oauth2.html'
      )
    });

    /**
     * Assigns a global variable that the oauth authentication window should
     * be able to access and send the callback data.
     */
    global.authenticateOauth2 = function (href) {
      delete global.authenticateOauth2;
      // Parse the url and prepare to do an ajax request to get the acces token.
      var uri = url.parse(href, true);

      if (uri.query.state !== state) {
        return next(new Error('Oauth2 state mismatch.'));
      }

      if (!uri.query.code) {
        return next(new Error('Oauth2 code missing.'));
      }

      middleware.trigger('ajax', {
        url: data.tokenUrl + '?' + qs.stringify({
          'code':          uri.query.code,
          'client_id':     data.clientId,
          'client_secret': data.clientSecret
        }),
        method: 'POST'
      }, function (err, xhr) {
        if (err) { return next(err); }

        var content = qs.parse(xhr.responseText);
        var data    = {
          tokenType:   content.token_type,
          accessToken: content.access_token
        };

        // The returned body from the ajax request could provide an error string
        return next(content.error && new Error(content.error), data);
      });
    };

    window.open(
      data.authorizationUrl + '?' + query,
      'authenticateOauth2', // Assigning a name stops overlapping windows
      'left=' + left + ',top=100,width=' + width + ',height=' + height
    );
  });
};
