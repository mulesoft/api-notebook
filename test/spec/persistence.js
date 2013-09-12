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
      expect(data.notebook).to.be.a('string');

      App.middleware.disuse('persistence:change', changeNotebook);
      return done();
    });

    App.start(fixture, function (err, app) {
      app.notebook.collection.at(0).view.setValue('test');
      return app.remove();
    });
  });

  it('should deserialize on loading a notebook', function (done) {
    App.middleware.use('persistence:load', function loadNotebook (data, next, done) {
      data.notebook = '# Simple test';
      App.middleware.disuse('persistence:load', loadNotebook);
      return done();
    });

    App.middleware.use('persistence:deserialize', function deserializeNotebook (data, next) {
      // Since the first notebook load would be deserializing an empty notebook,
      // we need to remove and pass the test on the correct callback.
      if (data.notebook === '# Simple test') {
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
    App.middleware.use('persistence:serialize', function serializeNotebook (data, next) {
      App.middleware.disuse('persistence:serialize', serializeNotebook);
      return done();
    });

    App.start(fixture, function (err, app) {
      app.notebook.collection.at(0).view.setValue('test');
      return app.remove();
    });
  });

  describe('Core', function () {
    it('should serialize as markdown', function (done) {
      App.persistence.serialize([{
        type: 'code',
        value: 'var test = "again";'
      }, {
        type: 'text',
        value: '# H1'
      }], function (err, notebook) {
        expect(notebook).to.equal('```javascript\nvar test = "again";\n```\n\n# H1');
        done();
      });
    });

    it('should deserialize from markdown', function (done) {
      App.persistence.set(
        'notebook',
        '```javascript\nvar test = true;\n```\n\n# Testing here'
      );

      App.persistence.deserialize(function (err, notebook) {
        expect(notebook.length).to.equal(2);
        expect(notebook[0].type).to.equal('code');
        expect(notebook[0].value).to.equal('var test = true;');
        expect(notebook[1].type).to.equal('text');
        expect(notebook[1].value).to.equal('# Testing here');
        return done();
      });
    });

    it('should render a new notebook with a single code cell', function (done) {
      App.persistence.load(function (err, notebook) {
        expect(notebook).to.equal('```javascript\n\n```');
        return done();
      });
    });
  });
});
