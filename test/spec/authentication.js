/* global describe, it, beforeEach, afterEach */

describe('Authentication', function () {
  describe('Oauth2', function () {
    var oldOpen, server;

    var authModalIntercept = function (data, next, done) {
      var show = data.show;

      data.show = function (modal) {
        show(modal);
        simulateEvent(modal.el.querySelector('[data-authenticate]'), 'click');
      };

      return next();
    };

    beforeEach(function () {
      server = sinon.fakeServer.create();
      sinon.stub(window, 'open').returns({
        close: function () {}
      });
      App.middleware.register('ui:modal', authModalIntercept);
    });

    afterEach(function () {
      server.restore();
      window.open.restore();
      App.middleware.deregister('ui:modal', authModalIntercept);
    });

    it('should do the server-side code flow', function (done) {
      var tokenUri         = 'https://www.example.com/oauth2/token';
      var authorizationUri = 'https://www.example.com/oauth2/authorize';

      App.middleware.trigger('authenticate', {
        type:                'OAuth 2.0',
        clientId:            '',
        clientSecret:        '',
        accessTokenUri:      tokenUri,
        authorizationGrants: 'code',
        authorizationUri:    authorizationUri
      }, function (err, auth) {
        expect(err).to.not.exist;
        expect(auth.accessToken).to.equal('123456');

        return done();
      });

      server.respondWith(
        'POST',
        'https://www.example.com/oauth2/token',
        [200, {
          'Content-Type': 'application/json'
        }, '{"access_token":"123456","token_type":"bearer"}']
      );

      expect(window.open.lastCall.args[0]).to.contain(authorizationUri);

      // Cheat and grab the state we passed through to the authentication server.
      var state = window.open.lastCall.args[0].match(/state=(\w+)/)[1];
      window.authenticateOAuth(App.Library.url.resolve(
        location.href, '/authenticate/oauth.html?code=123&state=' + state
      ));

      server.respond();
    });

    it('should miss tokenid', function (done) {
      var tokenUri         = 'https://www.example.com/oauth2/token';
      var authorizationUri = 'https://www.example.com/oauth2/authorize';

      App.middleware.trigger('authenticate', {
        type:                'OAuth 2.0',
        clientId:            '',
        clientSecret:        '',
        authorizationGrants: 'code',
        authorizationUri:    authorizationUri
      }, function (err, auth) {
        expect(err).to.exist;
        return done();
      });
    });

    it('should miss clientId', function (done) {
      var tokenUri         = 'https://www.example.com/oauth2/token';
      var authorizationUri = 'https://www.example.com/oauth2/authorize';

      App.middleware.trigger('authenticate', {
        type:                'OAuth 2.0',
        clientSecret:        '',
        authorizationGrants: 'code',
        accessTokenUri:      tokenUri,
        authorizationUri:    authorizationUri
      }, function (err, auth) {
        expect(err).to.exist;
        return done();
      });
    });

    it('should miss clientSecret', function (done) {
      var tokenUri         = 'https://www.example.com/oauth2/token';
      var authorizationUri = 'https://www.example.com/oauth2/authorize';

      App.middleware.trigger('authenticate', {
        type:                'OAuth 2.0',
        clientId:            '',
        authorizationGrants: 'code',
        accessTokenUri:      tokenUri,
        authorizationUri:    authorizationUri
      }, function (err, auth) {
        expect(err).to.exist;
        return done();
      });
    });

  });

  describe('Basic', function () {
    var oldOpen, server;

    var authModalIntercept = function (data, next, done) {
      var show = data.show;

      data.show = function (modal) {
        show(modal);
        simulateEvent(modal.el.querySelector('[data-authenticate]'), 'click');
      };

      return next();
    };

    beforeEach(function () {
      server = sinon.fakeServer.create();
      sinon.stub(window, 'open').returns({
        close: function () {}
      });
      App.middleware.register('ui:modal', authModalIntercept);
    });

    afterEach(function () {
      server.restore();
      window.open.restore();
      App.middleware.deregister('ui:modal', authModalIntercept);
    });

    it('should do the server-side code flow', function (done) {
      var tokenUri         = 'https://www.example.com/oauth2/token';
      var authorizationUri = 'https://www.example.com/oauth2/authorize';

      App.middleware.trigger('authenticate', {
        type:                'Basic Authentication',
        clientId:            '',
        clientSecret:        '',
        accessTokenUri:      tokenUri,
        authorizationGrants: 'code',
        authorizationUri:    authorizationUri,
        username: 'testUser',
        password: 'Password'
      }, function (err, auth) {
        expect(err).to.not.exist;
        expect(auth.username).to.equal('testUser');
        expect(auth.password).to.equal('Password');

        return done();
      });
    });

    it('should do the server-side code flow without basic', function (done) {
      var tokenUri         = 'https://www.example.com/oauth2/token';
      var authorizationUri = 'https://www.example.com/oauth2/authorize';

      App.middleware.trigger('authenticate', {
        type:                'Not basic',
        clientId:            '',
        clientSecret:        '',
        accessTokenUri:      tokenUri,
        authorizationGrants: 'code',
        authorizationUri:    authorizationUri,
        username: 'testUser',
        password: 'Password'
      }, function (err, auth) {
        expect(err).to.not.exist;
        expect(auth.username).to.equal('testUser');
        expect(auth.password).to.equal('Password');

        return done();
      });
    });
  });

});
