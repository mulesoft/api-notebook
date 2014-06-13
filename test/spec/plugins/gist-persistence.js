/* global describe, it, before, after */

describe('Gist Persistence Plugin', function () {
  var server;

  var id      = 'c5172f5b2ce786b86314';
  var userId  = 1088987;
  var content = '---\ntitle: Test Notebook\n---\n\n```javascript\nvar test = true;\n```';

  var clientId    = '0ca6a0a865144bbf595c';
  var accessToken = '5a043c2e7f6281bdb3ce6d142a6d96c052f0ce89';

  var authorizationResponse = '{"id":4772173,"url":"https://api.github.com/authorizations/4772173","app":{"name":"JSNotebook","url":"http://localhost:3000","client_id":"0ca6a0a865144bbf595c"},"token":"c1d4d9e7ccde7c0a52a9491e93afddbeb2bd05f7","note":null,"note_url":null,"created_at":"2013-12-05T00:45:31Z","updated_at":"2013-12-16T07:08:26Z","scopes":["gist"],"user":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png&r=x","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User","site_admin":false}}';

  var gistResponse = '{"id":' + JSON.stringify(id) + ',"files":{"notebook.md":{"filename":"notebook.md","type":"text/plain","language":"Markdown","raw_url":"https://gist.github.com/raw/c5172f5b2ce786b86314/22d8977bec38bca65c0781c27f124d02a0de6b36/notebook.md","size":19,"content":' + JSON.stringify(content) + '}},"public":false,"created_at":"2013-08-19T08:41:33Z","updated_at":"2013-08-19T08:41:33Z","description":null,"comments":0,"owner":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"comments_url":"https://api.github.com/gists/c5172f5b2ce786b86314/comments","forks":[],"history":[{"user":{"login":"blakeembrey","id":' + JSON.stringify(userId) + ',"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"version":"0b37963ae40526cdde5a99a34747ed0a1f08f0c7","committed_at":"2013-08-19T08:41:33Z","change_status":{"total":3,"additions":3,"deletions":0},"url":"https://api.github.com/gists/c5172f5b2ce786b86314/0b37963ae40526cdde5a99a34747ed0a1f08f0c7"}]}';

  var authModalIntercept = function (data, next, done) {
    var show = data.show;

    data.show = function (modal) {
      show(modal);
      simulateEvent(modal.el.querySelector('[data-authenticate]'), 'click');
    };

    return next();
  };

  before(function (done) {
    sinon.stub(window, 'open').returns({
      close: sinon.stub()
    });
    App.store._.github.clear();
    server = sinon.fakeServer.create();
    App.middleware.register(gistPersistencePlugin);
    App.middleware.register('ui:modal', authModalIntercept);
    App.persistence.new(done);
  });

  after(function () {
    server.restore();
    window.open.restore();
    App.middleware.deregister(gistPersistencePlugin);
    App.middleware.deregister('ui:modal', authModalIntercept);
  });

  it('should authenticate with github', function (done) {
    server.respondWith(
      'GET',
      /^https:\/\/api.github.com\/applications/,
      [
        200,
        {
          'Content-Type': 'application/json'
        },
        authorizationResponse
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
    window.authenticateOAuth(App.Library.url.resolve(
      location.href, '/authenticate/oauth.html?code=123&state=' + state
    ));

    server.respond();
  });

  it('should save to github', function (done) {
    var notebook = App.persistence.get('notebook');

    notebook.set('ownerId', userId);
    notebook.set('content', content);
    App.persistence.set('userId', userId);
    App.store._.github.set('accessToken', accessToken);

    server.respondWith(
      'POST',
      /^https:\/\/api.github.com\/gists/,
      [
        200,
        {
          'Content-Type': 'application/json'
        },
        gistResponse
      ]
    );

    App.persistence.save(notebook, function (err) {
      expect(notebook.get('id')).to.equal(id);
      expect(notebook.get('ownerId')).to.equal(userId);
      expect(notebook.get('content')).to.contain('var test = true;');
      expect(App.persistence.get('userId')).to.equal(userId);

      return done(err);
    });

    server.respond();
  });

  it('should load from a gist id', function (done) {
    var notebook = App.persistence.get('notebook');

    notebook.set('id', id, { silent: true });

    server.respondWith(
      'GET',
      new RegExp('^https://api.github.com/gists/' + id),
      [
        200,
        {
          'Content-Type': 'application/json'
        },
        gistResponse
      ]
    );

    App.persistence.load(notebook, function (err) {
      expect(notebook.get('content')).to.contain('var test = true;');

      return done(err);
    });

    server.respond();
  });
});
