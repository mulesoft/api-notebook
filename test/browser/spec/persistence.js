/* global describe, it */

describe('Persistence', function () {
  var fixture = document.getElementById('fixture');

  afterEach(function () {
    App.persistence.reset();
  });

  it('should attempt to load from an id', function (done) {
    App.middleware.use('persistence:load', function loadNotebook (data, next) {
      // Persistence will cycle through twice thanks to the relative file urls
      if (data.id === 123456) {
        App.middleware.disuse('persistence:load', loadNotebook);
        return done();
      }

      return next();
    });

    App.start(fixture, {
      id: 123456
    }, function (err, app) {
      return app.remove();
    });
  });

  it('should update the notebook when the cells change', function (done) {
    App.middleware.use('persistence:change', function changeNotebook (data, next) {
      expect(data.save).to.be.a('function');
      expect(data.contents).to.be.a('string');
      expect(data.notebook).to.be.an('array');

      App.middleware.disuse('persistence:change', changeNotebook);
      return done();
    });

    App.start(fixture, function (err, app) {
      app.notebook.collection.at(0).view.setValue('test');
      return app.remove();
    });
  });

  it('should deserialize on loading a notebook', function (done) {
    var testContent = '---\ntitle: Test Notebook\n---\n\n# Simple Test';

    App.middleware.use('persistence:load', function loadNotebook (data, next, done) {
      data.contents = testContent;
      App.middleware.disuse('persistence:load', loadNotebook);
      return done();
    });

    App.middleware.use('persistence:deserialize', function deserializeNotebook (data, next) {
      // Since the first notebook load would be deserializing an empty notebook,
      // we need to remove and pass the test on the correct callback.
      if (data.contents === testContent) {
        App.middleware.disuse('persistence:deserialize', deserializeNotebook);
        return done();
      }
      return next();
    });

    App.start(fixture, function (err, app) {
      return app.remove();
    });
  });

  it('should serialize the notebook each change', function (done) {
    var serialized = false;

    App.middleware.use('persistence:serialize', function serializeNotebook (data, next) {
      serialized = true;
      App.middleware.disuse('persistence:serialize', serializeNotebook);
      return next();
    });

    App.start(fixture, function (err, app) {
      app.notebook.collection.at(0).view.setValue('test');
      return app.remove();
    });

    App.nextTick(function () {
      expect(serialized).to.be.true;
      return done();
    });
  });

  it('should be able to load content', function (done) {
    var content = '---\ntitle: Test Notebook\n---\n\n# Simple Test';

    App.middleware.use('persistence:load', function load (data, next, done) {
      data.contents = content;
      App.middleware.disuse('persistence:load', load);
      return done();
    });

    App.start(fixture, function (err, app) {
      expect(app.notebook.collection.at(0).get('value')).to.equal('# Simple Test');

      // Check the application titles match.
      expect(App.persistence.get('title')).to.equal('Test Notebook');
      expect(app.el.querySelector('.notebook-title').textContent).to.equal('Test Notebook');

      app.remove();
      return done();
    });
  });

  describe('Core', function () {
    it('should serialize to markdown', function () {
      App.persistence.set('notebook', [{
        type: 'code',
        value: 'var test = "again";'
      }, {
        type: 'text',
        value: '# Heading'
      }]);

      expect(App.persistence.get('contents')).to.equal(
        '---\ntitle: ' + App.persistence.get('title') + '\n---\n\n' +
        '```javascript\nvar test = "again";\n```\n\n# Heading'
      );
    });

    it('should deserialize from markdown', function () {
      App.persistence.set(
        'contents',
        '```javascript\nvar test = true;\n```\n\n# Testing here'
      );

      var notebook = App.persistence.get('notebook');

      expect(notebook.length).to.equal(2);
      expect(notebook[0].type).to.equal('code');
      expect(notebook[0].value).to.equal('var test = true;');
      expect(notebook[1].type).to.equal('text');
      expect(notebook[1].value).to.equal('# Testing here');
    });

    it('should render a new notebook with a single code cell', function (done) {
      App.persistence.load(function (err) {
        expect(App.persistence.get('contents')).to.equal(
          '---\ntitle: New Notebook\n---\n\n```javascript\n\n```'
        );
        return done();
      });
    });
  });
});
