/* global describe, it */

describe('Completion', function () {
  var editor;

  beforeEach(function () {
    editor = new CodeMirror(document.body, {
      mode: 'javascript'
    });
    new App.CodeMirror.Completion(editor);
  });

  afterEach(function () {
    delete window.test;
    document.body.removeChild(editor.getWrapperElement());
  });

  var testAutocomplete = function (text, expected, unexpected) {
    return function (done) {
      testCompletion(editor, text, function (results) {
        if (expected) {
          expect(results).to.contain(expected);
        }

        if (unexpected) {
          expect(results).to.not.contain(unexpected);
        }

        done();
      });
    };
  };

  it('should complete keywords', testAutocomplete('sw', 'switch'));

  it('should complete variables', testAutocomplete('doc', 'document'));

  it('should complete exact matches', testAutocomplete('window', 'window'));

  it(
    'should complete using static analysis',
    testAutocomplete('var testing = "test";\ntes', 'testing')
  );

  it(
    'should complete from outer scope statically',
    testAutocomplete('var testing = "test";\nfunction () {\n  tes', 'testing')
  );

  it(
    'should complete from the global scope statically',
    testAutocomplete(
      'var testing = "test";\nfunction () {\n  var test = "again";\n' +
      '  function () {\n    tes',
      'testing'
    )
  );

  describe('properties', function () {
    it(
      'should complete object properties',
      testAutocomplete('document.getElementBy', 'getElementById')
    );

    it('should complete single characters', function (done) {
      window.test = { o: 'test' };

      testAutocomplete('test.', 'o')(done);
    });

    it('should complete numbers', testAutocomplete('123..to', 'toFixed'));

    it('should complete strings', testAutocomplete('"test".sub', 'substr'));

    it(
      'should complete regular expressions',
      testAutocomplete('(/./g).te', 'test')
    );

    it('should complete booleans', testAutocomplete('true.to', 'toString'));

    it('should complete function property', testAutocomplete('Date.n', 'now'));

    it(
      'should complete constructor properties',
      testAutocomplete('new Date().get', 'getYear')
    );

    it(
      'should complete object constructor properties',
      testAutocomplete('new window.Date().get', 'getYear')
    );

    it(
      'should complete normal object properties with new',
      testAutocomplete('new window.Dat', 'Date')
    );

    it(
      'constructor should work without parens',
      testAutocomplete('(new Date).get', 'getMonth')
    );

    it(
      'should work with parens around the value',
      testAutocomplete('(123).to', 'toFixed')
    );

    it(
      'should work with arbitrary prefixed characters for the completion',
      testAutocomplete('(wind', 'window')
    );

    it('should not complete plain functions', function (done) {
      window.test = function () {};
      window.test.prop = 'test';

      testAutocomplete('test().', null, 'prop')(done);
    });

    it(
      'should complete as soon as the property period is entered',
      testAutocomplete('window.', 'window')
    );

    describe('Whitespace', function () {
      it(
        'should ignore whitespace after variable',
        testAutocomplete('window  .win', 'window')
      );

      it(
        'should ignore whitespace before property',
        testAutocomplete('window.   win', 'window')
      );

      it(
        'should ignore whitespace before after after properties',
        testAutocomplete('window    .   win', 'window')
      );

      it(
        'should ignore whitespace at beginning of parens',
        testAutocomplete('(   123).to', 'toFixed')
      );

      it(
        'should ignore whitespace at the end of parens',
        testAutocomplete('(123    ).to', 'toFixed')
      );

      it(
        'should ignore whitespace at the beginning and end of parens',
        testAutocomplete('(    123    ).to', 'toFixed')
      );
    });
  });

  describe('middleware', function () {
    it('should be able to hook onto variable completion', function (done) {
      var spy = sinon.spy(function (data, next) {
        data.results.something = true;
        next();
      });

      App.middleware.use('completion:variable', spy);

      testAutocomplete('some', 'something')(function () {
        expect(spy).to.have.been.calledOnce;
        App.middleware.disuse('completion:variable', spy);
        done();
      });
    });

    it('should be able to hook onto context lookups', function (done) {
      var spy = sinon.spy(function (data, next, done) {
        data.context = { random: 'property' };
        done();
      });

      App.middleware.use('completion:context', spy);

      testAutocomplete('something.ran', 'random')(function () {
        expect(spy).to.have.been.calledOnce;
        App.middleware.disuse('completion:context', spy);
        done();
      });
    });

    it('should be able to hook into property completion', function (done) {
      var spy = sinon.spy(function (data, next) {
        data.results.somethingElse = true;
        next();
      });

      App.middleware.use('completion:property', spy);

      testAutocomplete('moreOf.some', 'somethingElse')(function () {
        expect(spy).to.have.been.calledOnce;
        App.middleware.disuse('completion:property', spy);
        done();
      });
    });
  });
});
