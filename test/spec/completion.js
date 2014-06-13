/* global describe, it */

describe('Completion', function () {
  var editor, completion;

  beforeEach(function () {
    editor = new App.CodeMirror.Editor(document.body, {
      mode: {
        name: 'javascript',
        globalVars: true
      }
    });

    new App.CodeMirror.Completion(editor, {
      window: window
    });

    // Requires the built-in Tern.js description completion data.
    completion = App.CodeMirror.sandboxCompletion(window);
    App.middleware.register(completion);
  });

  afterEach(function () {
    delete window.test;
    App.middleware.deregister(completion);
    document.body.removeChild(editor.getWrapperElement());
  });

  var testAutocomplete = function (text, expected, unexpected) {
    return function (done) {
      testCompletion(editor, text, function (results) {
        try {
          if (expected) {
            expect(results).to.contain(expected);
          }

          if (unexpected) {
            expect(results).to.not.contain(unexpected);
          }
        } catch (e) {
          return done(e);
        }

        return done();
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
      'nested constructor should work without parens',
      testAutocomplete('(new window.Date).get', 'getMonth')
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
      'should not complete global variables with multiline parens',
      testAutocomplete('test(\n"test").', null, 'window')
    );

    it(
      'should not assume the wrong context with multiline parens',
      testAutocomplete('test(\n"string").', null, 'substr')
    );

    it(
      'should not complete made up functions',
      testAutocomplete('"test".fake().', null, 'substr')
    );

    it('should complete numbers in the square brackets', function (done) {
      window.test = ['string'];

      testAutocomplete('test[0].', 'substr')(done);
    });

    it('should complete strings in the square brackets', function (done) {
      window.test = {
        string: 'test'
      };

      testAutocomplete('test["string"].', 'substr')(done);
    });

    it('should complete booleans in the square brackets', function (done) {
      window.test = {
        'true': 'test'
      };

      testAutocomplete('test[true].', 'substr')(done);
    });

    it('should complete undefined in the square brackets', function (done) {
      window.test = {
        'undefined': 'test'
      };

      testAutocomplete('test[undefined].', 'substr')(done);
    });

    it('should complete a regex in the square brackets', function (done) {
      window.test = {
        '/./': 'test'
      };

      testAutocomplete('test[/./].', 'substr')(done);
    });

    it('should complete basic variables in the square brackets', function (done) {
      window.test = {
        test: 'test'
      };

      window.variable = 'test';

      testAutocomplete('test[variable].', 'substr')(done);
    });

    it('should complete properties in the square brackets', function (done) {
      window.test = {
        test: 'test'
      };

      window.property = {
        nested: {
          test: 'test'
        }
      };

      testAutocomplete('test[property.nested.test].', 'substr')(done);
    });

    it('should complete sequential square bracket properties', function (done) {
      window.test = {
        test: {
          again: 'test'
        }
      };

      testAutocomplete('test["test"]["again"].', 'substr')(done);
    });

    it('should not complete empty bracket notation', function (done) {
      window.test = [1, 2, 3];

      testAutocomplete('test[].', null, 'concat')(done);
    });

    it('should complete nested square bracket properties', function (done) {
      window.test = {
        test: 42
      };

      window.property = {
        nested: 'test'
      };

      testAutocomplete('test[property["nested"]].', 'toFixed')(done);
    });

    it(
      'should complete array literals',
      testAutocomplete('[1, 2, 3].con', 'concat')
    );

    it(
      'should not complete global variables with the same name as globals',
      testAutocomplete(
        'var window = "test";\n(function () { window.doc', null, 'document'
      )
    );

    it(
      'should not complete arguments with the same name as globals',
      testAutocomplete(
        '(function (window) { window.doc', null, 'document'
      )
    );

    it(
      'should not complete local variables with the same name as globals',
      testAutocomplete(
        '(function () {\nvar window = "test";\nwindow.doc', null, 'document'
      )
    );

    it(
      'should not complete previous variables with the same name as globals',
      testAutocomplete(
        '(function () {\nvar window = "test";\n(function () {\nwindow.doc',
        null,
        'document'
      )
    );

    it(
      'should not complete square brackets that can\'t be done statically',
      testAutocomplete('window[something].w', null, 'window')
    );

    it(
      'should not crash when completing odd brackets',
      testAutocomplete(')(w', 'window')
    );

    it(
      'should complete properties around comments',
      testAutocomplete('document /* Test */ .get', 'getElementById')
    );

    it(
      'should complete properties after period and comment',
      testAutocomplete('document. /* Test */ get', 'getElementById')
    );

    describe('Tern.js Definitions', function () {
      it(
        'should complete simple constructors',
        testAutocomplete('Number(10).to', 'toFixed')
      );

      it(
        'should complete chained sequences',
        testAutocomplete('new Date().getTime().to', 'toFixed')
      );
    });

    describe('Multiple Lines', function () {
      it(
        'should complete properties across multiple lines',
        testAutocomplete('document\n.getEle', 'getElementById')
      );

      it(
        'should complete properties across multiple lines with whitespace',
        testAutocomplete('document \n\t.getEle', 'getElementById')
      );

      it(
        'should complete properties over multiple parts and lines',
        testAutocomplete('document\n  .\t\n getEl', 'getElementById')
      );

      it(
        'should complete square brackets over multiple lines',
        testAutocomplete('window\n["Date"]\n.', 'now')
      );

      it(
        'should complete square brackets over multiple lines with whitespace',
        testAutocomplete('window \n\t[ "Date"  ].\n\tn', 'now')
      );

      it(
        'should complete arrays over multiple lines',
        testAutocomplete('[\n1, 2, 3\n].', 'concat')
      );

      it(
        'should complete after comment lines',
        testAutocomplete('// Random comment\ndocument.get', 'getElementById')
      );

      it(
        'should complete over comment lines',
        testAutocomplete('document\n// Comment\n.get', 'getElementById')
      );

      it(
        'should complete with comments at the end of a line',
        testAutocomplete('document // Comment\n.get', 'getElementById')
      );

      it(
        'should complete with comment and period on the first line',
        testAutocomplete('document. // Comment\nget', 'getElementById')
      );

      it(
        'should complete code on a new line',
        testAutocomplete('window.test;\ndocument.get', 'getElementById')
      );

      it(
        'should complete code on a new line without line termination',
        testAutocomplete('window.test\ndocument.get', 'getElementById')
      );
    });

    describe('Function Returns', function () {
      it(
        'should work with square brackets',
        testAutocomplete('Date["now"]().', 'toFixed')
      );

      it(
        'should work as expected with new in parens',
        testAutocomplete('(new Date).getHours().', 'toFixed')
      );

      it(
        'should work as expected with string literals',
        testAutocomplete('"test".substr(0).', 'substr')
      );

      it(
        'should work as expected with numbers',
        testAutocomplete('(5).toFixed().', 'substr')
      );

      it(
        'should work as expected with booleans',
        testAutocomplete('true.toString().', 'substr')
      );

      it(
        'should work with the math object',
        testAutocomplete('Math.random().', 'toFixed')
      );

      it(
        'should work with root number functions',
        testAutocomplete('parseInt(10).', 'toFixed')
      );

      it(
        'should work with root string functions',
        testAutocomplete('encodeURI(" ").', 'substr')
      );

      it(
        'should work with nested array returns',
        testAutocomplete('[].concat(1).concat(2).', 'concat')
      );

      it(
        'should work with nested regex returns',
        testAutocomplete('(/./).exec("go").', 'concat')
      );

      it(
        'should work with odd nested function parens',
        testAutocomplete('("test".substr)(0).', 'substr')
      );

      it(
        'should work with rediculous nested function parens',
        testAutocomplete('((("test".substr)))(((0))).', 'substr')
      );

      it(
        'should work with nested square bracket notation',
        testAutocomplete('Math["random"]()["toFixed"]().', 'substr')
      );
    });

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

      it('should ignore whitespace with square brackets', function (done) {
        window.test = ['string'];

        testAutocomplete('test  [ 0  ].', 'substr')(done);
      });
    });
  });

  describe('middleware', function () {
    it('should be able to hook onto variable completion', function (done) {
      var spy = sinon.spy(function (data, next) {
        data.results.something = true;
        next();
      });

      App.middleware.register('completion:variable', spy);

      testAutocomplete('some', 'something')(function () {
        expect(spy).to.have.been.calledOnce;
        App.middleware.deregister('completion:variable', spy);
        done();
      });
    });

    it('should be able to hook onto context lookups', function (done) {
      var spy = sinon.spy(function (data, next, done) {
        data.context = { random: 'property' };
        done();
      });

      App.middleware.register('completion:context', spy);

      testAutocomplete('something.ran', 'random')(function () {
        expect(spy).to.have.been.calledOnce;
        App.middleware.deregister('completion:context', spy);
        done();
      });
    });

    it('should be able to hook into property completion', function (done) {
      var spy = sinon.spy(function (data, next) {
        data.results.somethingElse = true;
        next();
      });

      App.middleware.register('completion:property', spy);

      testAutocomplete('moreOf.some', 'somethingElse')(function () {
        expect(spy).to.have.been.calledOnce;
        App.middleware.deregister('completion:property', spy);
        done();
      });
    });
  });
});
