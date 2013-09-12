/* global describe, it, beforeEach, afterEach */

describe('Gist Persistence Plugin', function () {
  var server;

  var id       = 'c5172f5b2ce786b86314';
  var userId   = 1088987;
  var notebook = '```javascript\nvar test = true\n```';

  var clientId    = '0ca6a0a865144bbf595c';
  var tokenType   = 'bearer';
  var accessToken = '5a043c2e7f6281bdb3ce6d142a6d96c052f0ce89';

  var authorisationResponse = '{"id":3313648,"url":"https://api.github.com/authorizations/3313648","app":{"name":"JSNotebook","url":"http://localhost:3000","client_id":' + JSON.stringify(clientId) + '},"token":' + JSON.stringify(accessToken) + ',"note":null,"note_url":null,"created_at":"2013-08-14T04:24:22Z","updated_at":"2013-09-11T04:18:18Z","scopes":["gist"],"user":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"}}';

  var gistResponse = '{"id":' + JSON.stringify(id) + ',"files":{"notebook.md":{"filename":"notebook.md","type":"text/plain","language":"Markdown","raw_url":"https://gist.github.com/raw/c5172f5b2ce786b86314/22d8977bec38bca65c0781c27f124d02a0de6b36/notebook.md","size":19,"content":' + JSON.stringify(notebook) + '}},"public":false,"created_at":"2013-08-19T08:41:33Z","updated_at":"2013-08-19T08:41:33Z","description":null,"comments":0,"user":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"comments_url":"https://api.github.com/gists/c5172f5b2ce786b86314/comments","forks":[],"history":[{"user":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"version":"0b37963ae40526cdde5a99a34747ed0a1f08f0c7","committed_at":"2013-08-19T08:41:33Z","change_status":{"total":3,"additions":3,"deletions":0},"url":"https://api.github.com/gists/c5172f5b2ce786b86314/0b37963ae40526cdde5a99a34747ed0a1f08f0c7"}]}';

  beforeEach(function () {
    server = sinon.fakeServer.create();
    gistPersistencePlugin.attach(App.middleware);
  });

  afterEach(function () {
    server.restore();
    App.persistence.reset();
    gistPersistencePlugin.detach(App.middleware);
  });

  it('should authenticate with github', function (done) {
    App.middleware.use('authenticate:oauth2', function auth (data, next, done) {
      // Emulate jumping through the oauth hoops, in reality this would take
      // much longer.
      setTimeout(function () {
        data.tokenType   = tokenType;
        data.accessToken = accessToken;
        return done();
      }, 100);
      setTimeout(function () {
        server.respond();
      }, 150);
      App.middleware.disuse(auth);
    });

    server.respondWith(
      'GET',
      'https://api.github.com/applications/' + clientId + '/tokens/' + accessToken,
      [200,
      {
        'Content-Type': 'application/json'
      },
      authorisationResponse]
    );

    App.persistence.authenticate(function (err, authUserId) {
      expect(err).to.not.exist;
      expect(authUserId).to.equal(userId);
      return done();
    });
  });

  it('should save to github ', function (done) {
    App.persistence.set('userId',   userId);
    App.persistence.set('notebook', notebook);

    server.respondWith(
      'POST',
      'https://api.github.com/gists?access_token=' + accessToken,
      [200,
      {
        'Content-Type': 'application/json'
      },
      gistResponse]
    );

    App.persistence.save(function (err, content) {
      expect(content).to.equal(notebook);
      expect(App.persistence.get('id')).to.equal(id);
      expect(App.persistence.get('userId')).to.equal(userId);
      expect(App.persistence.get('ownerId')).to.equal(userId);

      return done();
    });

    server.respond();
  });

  it('should load from a gist id', function () {
    App.persistence.set('id', id);

    server.respondWith(
      'GET',
      'https://api.github.com/gists/' + id,
      [200,
      {
        'Content-Type': 'application/json'
      },
      gistResponse]
    );

    App.persistence.load(function (err, notebook) {
      expect(notebook).to.equal(notebook);

      return done();
    });
  });
});
