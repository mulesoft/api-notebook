/* global describe, it, beforeEach, afterEach */

describe('Gist Persistence Plugin', function () {
  var server;

  var id       = 'c5172f5b2ce786b86314';
  var userId   = 1088987;
  var notebook = '---\ntitle: Test Notebook\n---\n\n```javascript\nvar test = true\n```';

  var clientId    = '0ca6a0a865144bbf595c';
  var accessToken = '5a043c2e7f6281bdb3ce6d142a6d96c052f0ce89';

  var userResponse = '{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://0.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User","name":"BlakeEmbrey","company":"","blog":"http://blakeembrey.me/","location":"Brisbane,Queensland,Australia","email":"hello@blakeembrey.com","hireable":true,"bio":null,"public_repos":35,"followers":88,"following":57,"created_at":"2011-09-29T06:41:12Z","updated_at":"2013-09-26T01:23:13Z","public_gists":3}';

  var gistResponse = '{"id":' + JSON.stringify(id) + ',"files":{"notebook.md":{"filename":"notebook.md","type":"text/plain","language":"Markdown","raw_url":"https://gist.github.com/raw/c5172f5b2ce786b86314/22d8977bec38bca65c0781c27f124d02a0de6b36/notebook.md","size":19,"content":' + JSON.stringify(notebook) + '}},"public":false,"created_at":"2013-08-19T08:41:33Z","updated_at":"2013-08-19T08:41:33Z","description":null,"comments":0,"user":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"comments_url":"https://api.github.com/gists/c5172f5b2ce786b86314/comments","forks":[],"history":[{"user":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"version":"0b37963ae40526cdde5a99a34747ed0a1f08f0c7","committed_at":"2013-08-19T08:41:33Z","change_status":{"total":3,"additions":3,"deletions":0},"url":"https://api.github.com/gists/c5172f5b2ce786b86314/0b37963ae40526cdde5a99a34747ed0a1f08f0c7"}]}';

  beforeEach(function () {
    App.persistence.reset();
    sinon.stub(window, 'open');
    App.store._.oauth2.clear();
    server = sinon.fakeServer.create();
    gistPersistencePlugin.attach(App.middleware);
  });

  afterEach(function () {
    server.restore();
    window.open.restore();
    gistPersistencePlugin.detach(App.middleware);
  });

  it('should authenticate with github', function (done) {
    server.respondWith(
      'GET',
      /^https:\/\/api.github.com\/user/,
      [
        200,
        {
          'Content-Type': 'application/json'
        },
        userResponse
      ]
    );

    server.respondWith(
      'POST',
      /^https:\/\/github.com\/login\/oauth\/access_token/,
      [
        200,
        {
          'Content-Type': 'application/json'
        },
        JSON.stringify({
          'token_type': 'bearer',
          'access_token': accessToken
        })
      ]
    );

    App.persistence.authenticate(function (err) {
      expect(err).to.not.exist;
      expect(App.persistence.get('userId')).to.equal(userId);
      return done();
    });

    var state = window.open.lastCall.args[0].match(/state=(\w+)/)[1];
    window.authenticateOauth2('http://localhost:3000/?code=123&state=' + state);

    server.respond();
  });

  it('should save to github ', function (done) {
    App.persistence.set('userId',   userId);
    App.persistence.set('ownerId',  userId);
    App.persistence.set('contents', notebook);
    App.store._.oauth2.set('https://github.com/login/oauth/authorize', {
      accessToken: accessToken
    });

    server.respondWith(
      'POST',
      'https://api.github.com/gists?access_token=' + accessToken,
      [
        200,
        {
          'Content-Type': 'application/json'
        },
        gistResponse
      ]
    );

    App.persistence.save(function (err, notebookId) {
      expect(App.persistence.get('id')).to.equal(id);
      expect(App.persistence.get('userId')).to.equal(userId);
      expect(App.persistence.get('ownerId')).to.equal(userId);
      expect(App.persistence.get('contents')).to.equal(notebook);

      return done();
    });

    server.respond();
  });

  it('should load from a gist id', function (done) {
    App.persistence.set('id', id);

    server.respondWith(
      'GET',
      'https://api.github.com/gists/' + id,
      [
        200,
        {
          'Content-Type': 'application/json'
        },
        gistResponse
      ]
    );

    App.persistence.load(function (err) {
      expect(App.persistence.get('contents')).to.equal(notebook);

      return done();
    });

    server.respond();
  });
});
