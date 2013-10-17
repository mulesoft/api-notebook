/* global describe, it */

describe('Function Property Filter Plugin', function () {
  beforeEach(function () {
    functionPropertyFilterPlugin.attach(App.middleware);
  });

  afterEach(function () {
    functionPropertyFilterPlugin.detach(App.middleware);
  });

  describe('Inspector', function () {
    it('should hide the @return property from display', function () {
      var fn = function () {};
      fn['@return'] = 'test';

      var inspector = new App.View.Inspector({ inspect: fn });
      inspector.render().trigger('open');

      var properties = App._.map(inspector.children, function (child) {
        return ~child.el.className.indexOf('hide') ? null : child.property;
      });

      expect(properties).to.not.contain('@return');
    });
  });

  describe('Completion', function () {
    var editor;

    var testAutocomplete = function (text, done) {
      return testCompletion(editor, text, done);
    };

    beforeEach(function () {
      editor = new CodeMirror(document.body, {
        mode: 'javascript'
      });

      new App.CodeMirror.Completion(editor, {
        global:  window,
        context: window
      });
    });

    afterEach(function () {
      delete window.test;
      document.body.removeChild(editor.getWrapperElement());
    });

    it('should autocomplete strings', function (done) {
      window.test = function () {};
      window.test['@return'] = 'output';

      testAutocomplete('test().sub', function (results) {
        expect(results).to.contain('substr');
        done();
      });
    });

    it('should autocomplete objects', function (done) {
      window.test = function () {};
      window.test['@return'] = { test: 'test' };

      testAutocomplete('test().te', function (results) {
        expect(results).to.contain('test');
        done();
      });
    });

    it('should autocomplete chained functions', function (done) {
      window.test = function () {};
      window.test['@return'] = { test: function () {} };
      window.test['@return'].test['@return'] = 'again';

      testAutocomplete('test().test().sub', function (results) {
        expect(results).to.contain('substr');
        done();
      });
    });

    it('should autocomplete returned functions', function (done) {
      window.test = function () {};
      window.test['@return'] = function () {};
      window.test['@return']['@return'] = 'again';

      testAutocomplete('test()().sub', function (results) {
        expect(results).to.contain('substr');
        done();
      });
    });
  });
});
