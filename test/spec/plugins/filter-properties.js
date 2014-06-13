/* global describe, it */

describe('Filter Properties Plugin', function () {
  before(function () {
    App.middleware.register(filterPropertiesPlugin);
  });

  after(function () {
    App.middleware.deregister(filterPropertiesPlugin);
  });

  describe('Inspector', function () {
    it('should hide the internal prototype from display', function () {
      var inspector = new App.View.Inspector({ inspect: {}, window: window });
      inspector.render().trigger('open');
      expect(inspector.children).to.be.empty;
    });
  });

  describe('Completion', function () {
    var editor;

    var testAutocomplete = function (text, expected) {
      return function (done) {
        testCompletion(editor, text, function (results) {
          if (expected === +expected) {
            expect(results.length).to.equal(expected);
          } else {
            expect(results).to.contain(expected);
          }
          done();
        });
      };
    };

    beforeEach(function () {
      editor = new App.CodeMirror.Editor(document.body, {
        mode: 'javascript'
      });

      new App.CodeMirror.Completion(editor, {
        window: window
      });
    });

    afterEach(function () {
      delete window.test;
      document.body.removeChild(editor.getWrapperElement());
    });

    describe('Object', function () {
      it('should not display object prototype properties in completion', function (done) {
        window.test = {};

        testAutocomplete('test.', 0)(done);
      });

      it('should display user defined properties of the same name', function (done) {
        window.test = { hasOwnProperty: true };

        testAutocomplete('test.has', 'hasOwnProperty')(done);
      });

      it('should work as expected with Object.create(null)', function (done) {
        window.test = Object.create(null);
        window.test.hasOwnProperty = true;

        testAutocomplete('test.has', 'hasOwnProperty')(done);
      });
    });

    describe('Function', function () {
      it('should not display function prototype properties in completion', function (done) {
        window.test = function () {};

        testAutocomplete('test.', 0)(done);
      });

      it('should display user defined properties of the same name', function (done) {
        window.test = function () {};
        window.test.bind = 'test';

        testAutocomplete('test.b', 'bind')(done);
      });
    });
  });
});
