/* global describe, it, beforeEach, afterEach */

describe('Authentication', function () {
  describe('Oauth2', function () {
    var oldOpen, server;

    beforeEach(function () {
      server = sinon.fakeServer.create();
      sinon.stub(window, 'open');
    });

    afterEach(function () {
      server.restore();
      window.open.restore();
    });

    it('should do the normal oauth2 authentication flow', function (done) {
      var tokenUrl         = 'https://www.example.com/oauth2/token';
      var authorizationUrl = 'https://www.example.com/oauth2/authorize';

      App.middleware.trigger('authenticate:oauth2', {
        'tokenUrl':         tokenUrl,
        'authorizationUrl': authorizationUrl
      }, function (err, auth) {
        expect(err).to.not.exist;
        expect(auth.accessToken).to.equal('123456');

        return done();
      });

      server.respondWith(
        'POST',
        /^https\:\/\/www.example.com\/oauth2\/token.+code=123/,
        [200, {
          'Content-Type': 'application/json'
        }, '{"access_token":"123456","token_type":"bearer"}']
      );

      expect(window.open.lastCall.args[0]).to.contain(authorizationUrl);
      // Cheat and grab the state we passed through to the authentication server.
      var state = window.open.lastCall.args[0].match(/state=(\w+)/)[1];
      window.authenticateOauth2('http://localhost:3000/?code=123&state=' + state);
      // Respond to the request for the token
      App.nextTick(function () {
        server.respond();
      });
    });
  });
});
