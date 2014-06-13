/* global describe, it */

describe('Persistence', function () {
  var fixture = document.getElementById('fixture');

  beforeEach(function (done) {
    App.persistence.new(done);
  });

  it('should attempt to load from an id', function (done) {
    var loaded = false;

    App.middleware.register('persistence:load', function loadNotebook (data, next, done) {
      // Persistence will cycle through twice thanks to the relative file urls
      if (data.id === '123456') {
        loaded = true;
        App.middleware.deregister('persistence:load', loadNotebook);
      }

      return done();
    });

    App.start(fixture, {
      config: {
        id: '123456'
      }
    }, function (err, app) {
      app.remove();
      expect(loaded).to.be.true;
      return done();
    });
  });

  it('should update the notebook when the cells change', function (done) {
    App.middleware.register('persistence:change', function changeNotebook (data, next) {
      expect(data.save).to.be.a('function');
      expect(data.contents).to.be.a('string');
      expect(data.notebook).to.be.an('array');

      App.middleware.deregister('persistence:change', changeNotebook);
    });

    App.start(fixture, function (err, app) {
      App.Library.DOMBars.VM.exec(function () {
        app.data.get('notebook').collection.at(0).view.setValue('test');
        app.remove();
        return done();
      });
    });
  });

  it('should deserialize on loading a notebook', function (done) {
    var testContent  = '---\ntitle: Test Notebook\n---\n\n# Simple Test';
    var contentMatch = false;

    App.middleware.register('persistence:load', function loadNotebook (data, next, done) {
      data.content = testContent;
      App.middleware.deregister('persistence:load', loadNotebook);
      return done();
    });

    App.middleware.register('persistence:deserialize', function deserializeNotebook (data, next, done) {
      // Since the first notebook load would be deserializing an empty notebook,
      // we need to remove and pass the test on the correct callback.
      if (data.content === testContent) {
        contentMatch = true;
        App.middleware.deregister('persistence:deserialize', deserializeNotebook);
      }

      return done();
    });

    App.start(fixture, function (err, app) {
      expect(contentMatch).to.be.true;
      app.remove();
      return done();
    });
  });

  it('should serialize the notebook each change', function (done) {
    var serialized = false;

    App.middleware.register('persistence:serialize', function serializeNotebook (data, next) {
      serialized = true;
      App.middleware.deregister('persistence:serialize', serializeNotebook);
      return next();
    });

    App.start(fixture, function (err, app) {
      return app.remove();
    });

    App.nextTick(function () {
      expect(serialized).to.be.true;
      return done();
    });
  });

  it('should be able to load content', function (done) {
    App.middleware.register('persistence:load', function load (data, next, done) {
      data.content = '---\ntitle: Test Notebook\n---\n\n# Simple Test';
      App.middleware.deregister('persistence:load', load);
      return done();
    });

    App.start(fixture, function (err, app) {
      expect(err).to.not.exist;

      App.Library.DOMBars.VM.exec(function () {
        expect(
          app.data.get('notebook').collection.at(0).get('value')
        ).to.equal('# Simple Test');

        // Check the application titles match.
        expect(App.persistence.get('notebook').get('meta').get('title')).to.equal('Test Notebook');
        expect(app.el.querySelector('.notebook-title').value).to.equal('Test Notebook');

        app.remove();
        return done();
      });
    });
  });

  describe('Core', function () {
    it('should serialize to markdown', function () {
      App.persistence.get('notebook').set('cells', [{
        type: 'code',
        value: 'var test = "again";'
      }, {
        type: 'text',
        value: '# Heading'
      }]);

      expect(App.persistence.get('notebook').get('content')).to.equal(
        '---\ntitle: ' + App.persistence.get('notebook').get('meta').get('title') + '\n---\n\n' +
        '```javascript\nvar test = "again";\n```\n\n# Heading'
      );
    });

    it('should deserialize from markdown', function () {
      App.persistence.get('notebook').set(
        'content', '```javascript\nvar test = true;\n```\n\n# Testing here'
      );

      var cells = App.persistence.get('notebook').get('cells');

      expect(cells.length).to.equal(2);
      expect(cells[0].type).to.equal('code');
      expect(cells[0].value).to.equal('var test = true;');
      expect(cells[1].type).to.equal('text');
      expect(cells[1].value).to.equal('# Testing here');
    });

    it('should render a new notebook with a single code cell', function (done) {
      App.persistence.new(function (err) {
        var cells = App.persistence.get('notebook').get('cells');

        expect(cells.length).to.equal(1);
        expect(cells[0].type).to.equal('code');
        expect(cells[0].value).to.equal('');

        return done();
      });
    });
  });
});
