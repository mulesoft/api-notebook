/* global describe, it, beforeEach, afterEach */

describe('Local Storage Persistence Plugin', function () {
  var id       = '213';
  var notebook = '---\ntitle: Test Notebook\n---\n\n# Testing localStorage';

  beforeEach(function () {
    localStoragePersistencePlugin.attach(App.middleware);
  });

  afterEach(function () {
    App.persistence.reset();
    localStorage.removeItem('notebook-' + id);
    localStoragePersistencePlugin.detach(App.middleware);
  });

  it('should save to localStorage with a made up id', function (done) {
    App.persistence.set('id',       id);
    App.persistence.set('contents', notebook);

    App.persistence.save(function (err) {
      expect(App.persistence.get('id')).to.equal(id);
      expect(App.persistence.get('contents')).to.equal(notebook);

      return done();
    });
  });

  it('should load the id from localStorage', function (done) {
    App.persistence.set('id', id);
    localStorage.setItem('notebook-' + id, notebook);

    App.persistence.load(function (err) {
      expect(App.persistence.get('contents')).to.equal(notebook);

      return done();
    });
  });
});
