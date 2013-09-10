/* global describe, it */

describe('Gist Model', function () {
  var Model = App.Model.Gist;

  var sampleResponse = '{"id":"c5172f5b2ce786b86314","files":{"notebook.md":{"filename":"notebook.md","type":"text/plain","language":"Markdown","raw_url":"https://gist.github.com/raw/c5172f5b2ce786b86314/22d8977bec38bca65c0781c27f124d02a0de6b36/notebook.md","size":19,"content":"\\tvar a = \'test\';\\n\\n\\t"}},"public":false,"created_at":"2013-08-19T08:41:33Z","updated_at":"2013-08-19T08:41:33Z","description":null,"comments":0,"user":{"login":"blakeembrey","id":1088987,"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"comments_url":"https://api.github.com/gists/c5172f5b2ce786b86314/comments","forks":[],"history":[{"user":{"login":"blakeembrey","id":1088987,"avatar_url":"https://1.gravatar.com/avatar/a7436e2338a2ae070a61ad78d853a6be?d=https%3A%2F%2Fidenticons.github.com%2F2df2061662cbebb310d5f239686b398d.png","gravatar_id":"a7436e2338a2ae070a61ad78d853a6be","url":"https://api.github.com/users/blakeembrey","html_url":"https://github.com/blakeembrey","followers_url":"https://api.github.com/users/blakeembrey/followers","following_url":"https://api.github.com/users/blakeembrey/following{/other_user}","gists_url":"https://api.github.com/users/blakeembrey/gists{/gist_id}","starred_url":"https://api.github.com/users/blakeembrey/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/blakeembrey/subscriptions","organizations_url":"https://api.github.com/users/blakeembrey/orgs","repos_url":"https://api.github.com/users/blakeembrey/repos","events_url":"https://api.github.com/users/blakeembrey/events{/privacy}","received_events_url":"https://api.github.com/users/blakeembrey/received_events","type":"User"},"version":"0b37963ae40526cdde5a99a34747ed0a1f08f0c7","committed_at":"2013-08-19T08:41:33Z","change_status":{"total":3,"additions":3,"deletions":0},"url":"https://api.github.com/gists/c5172f5b2ce786b86314/0b37963ae40526cdde5a99a34747ed0a1f08f0c7"}]}';

  it('should exist', function () {
    expect(Model).to.be.a('function');
  });

  describe('Gist instance', function () {
    var model;

    beforeEach(function () {
      model = new Model();
    });

    it('should have its own notebook instance', function () {
      expect(model.notebook).to.be.an.instanceof(App.Collection.Notebook);
    });

    describe('syncing', function () {
      var server;

      beforeEach(function () {
        server = sinon.fakeServer.create();
      });

      afterEach(function () {
        server.restore();
      });

      it.skip('should fetch an existing notebook', function (done) {
        var spy = sinon.spy(function () {
          expect(model.get('id')).to.equal('c5172f5b2ce786b86314');
          done();
        });

        server.respondWith('GET', 'https://api.github.com/gists', [200, {
          'Content-Type': 'application/json'
        }, sampleResponse]);

        model.fetch({
          success: spy
        });

        server.respond();
      });

      it.skip('should update an existing notebook', function (done) {
        var spy = sinon.spy(function () {
          expect(model.get('id')).to.equal('c5172f5b2ce786b86314');
          expect(model.get('user').login).to.equal('blakeembrey');
          done();
        });

        model.set('id', 'c5172f5b2ce786b86314');
        model.set('files', {
          'notebook.md': {
            content: '\tvar a = \'test\';\n\n\t'
          }
        });

        server.respondWith('PATCH', 'https://api.github.com/gists/c5172f5b2ce786b86314', [200, {
          'Content-Type': 'application/json'
        }, sampleResponse]);

        model.save(null, {
          patch: true,
          success: spy
        });

        server.respond();
      });

      it.skip('should create a new notebook', function (done) {
        var spy = sinon.spy(function () {
          expect(model.get('id')).to.equal('c5172f5b2ce786b86314');
          expect(model.get('user').login).to.equal('blakeembrey');
          done();
        });

        model.set('files', {
          'notebook.md': {
            content: '\tvar a = \'test\';\n\n\t'
          }
        });

        server.respondWith('POST', 'https://api.github.com/gists', [200, {
          'Content-Type': 'application/json'
        }, sampleResponse]);

        model.save(null, {
          patch: true,
          success: spy
        });

        server.respond();
      });

      it.skip('should fork a new notebook', function (done) {
        var id = 'kjehfauhuakhfkjhakhfdjhaj';

        var spy = sinon.spy(function (err, gist) {
          expect(model.get('id')).to.equal(id);
          expect(gist.get('user').login).to.equal('blakeembrey');
          done();
        });

        model.set({
          'id': id,
          'files': {
            'notebook.md': {
              content: '\tvar a = \'test\';\n\n\t'
            }
          }
        });

        server.respondWith(
          'POST',
          'https://api.github.com/gists/' + id + '/forks',
          [200, { 'Content-Type': 'application/json' }, sampleResponse]
        );

        model.fork(spy);

        server.respond();
      });
    });

    describe('#setNotebook', function () {
      it('should set the notebook file', function () {
        model.setNotebook('test');

        expect(model.get('files')['notebook.md'].content).to.equal('test');
      });
    });

    describe('#getNotebook', function () {
      it('should set the notebook file', function () {
        model.setNotebook('test');

        expect(model.getNotebook()).to.equal('test');
      });
    });

    describe('#isOwner', function () {
      it('should return a boolean respresenting gist ownership', function () {
        model.set('id', 'jhdgfjhagfhjdgshjfg');
        model.set('user', {
          id: 123
        });

        expect(model.isOwner()).to.be.false;

        model.user = new App.Model.Session({ id: 123 });

        expect(model.isOwner()).to.be.true;
      });
    });
  });
});
