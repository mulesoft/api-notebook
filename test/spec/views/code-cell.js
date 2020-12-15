/* global describe, it */

describe('Code Cell', function () {
  var Code    = App.View.CodeCell;
  var fixture = document.getElementById('fixture');

  it('should exist', function () {
    expect(Code).to.be.a('function');
  });

  describe('Code Cell instance', function () {
    var view, sandbox;

    beforeEach(function () {
      view    = new Code();
      sandbox = new App.Sandbox();

      view.notebook = {
        sandbox: sandbox,
        executePrevious: function (cell, done) {
          return done && done();
        },
        completionOptions: {
          window: sandbox.window
        }
      };

      view.model.collection = {
        codeIndexOf: sinon.stub().returns(0),
        getNext:     sinon.stub().returns(undefined),
        getPrev:     sinon.stub().returns(undefined)
      };
    });

    it('should have a class', function () {
      expect(view.el.className).to.contain('cell');
      expect(view.el.className).to.contain('cell-code');
    });

    describe('Using the editor', function () {
      var editor;

      beforeEach(function () {
        view   = view.render().appendTo(fixture);
        editor = view.editor;
      });

      afterEach(function () {
        view.remove();
      });

      it('should be a javascript editor', function () {
        expect(editor.getOption('mode').name).to.equal('javascript');
      });

      describe('Keyboard Shortcuts', function () {
        var UP    = 38;
        var DOWN  = 40;
        var ENTER = 13;

        it('Execute Code (`Enter`)', function () {
          var spy = sinon.spy();
          view.execute = spy;
          fakeKey(editor, ENTER);
          expect(spy).to.have.been.calledOnce;
        });

        it('New Line (`Shift-Enter`)', function () {
          expect(editor.getValue()).to.equal('');
          fakeKey(editor, ENTER, { shiftKey: true });
          expect(editor.getValue()).to.equal('\n');
          fakeKey(editor, ENTER, { shiftKey: true });
          expect(editor.getValue()).to.equal('\n\n');
        });

        it('Browse Code Up (`Up`)', function () {
          var spy = sinon.spy();
          view.on('browseUp', spy);
          editor.setValue('more\nthan\none\nline');
          editor.setCursor({ line: 2, char: 0 });
          fakeKey(editor, UP);
          expect(spy).to.not.have.been.calledOnce;
          expect(editor.getCursor().line).to.equal(1);
          fakeKey(editor, UP);
          expect(spy).to.not.have.been.calledOnce;
          expect(editor.getCursor().line).to.equal(0);
          fakeKey(editor, UP);
          expect(spy).to.have.been.calledOnce;
        });

        it('Browse Code Down (`Down`)', function () {
          var spy = sinon.spy();
          view.on('browseDown', spy);
          editor.setValue('more\nthan\none\nline');
          editor.setCursor({ line: 1, char: 0 });
          fakeKey(editor, DOWN);
          expect(spy).to.not.have.been.calledOnce;
          expect(editor.getCursor().line).to.equal(2);
          fakeKey(editor, DOWN);
          expect(spy).to.not.have.been.calledOnce;
          expect(editor.getCursor().line).to.equal(3);
          fakeKey(editor, DOWN);
          expect(spy).to.have.been.calledOnce;
        });
      });

      describe('Execute Code', function () {
        it('should render the result', function (done) {
          var code = '10';

          view.on('execute', function (view, data) {
            expect(data.result).to.equal(10);
            expect(data.isError).to.be.false;
            expect(
              view.el.querySelector('.result-content').textContent
            ).to.equal('10');
            expect(view.model.get('value')).to.equal(code);
            expect(view.model.get('result')).to.equal(10);
            done();
          });

          view.setValue(code);
          view.execute();
        });

        it('should render an error', function (done) {
          var code = 'throw new Error(\'Testing\');';

          view.on('execute', function (view, data) {
            expect(data.isError).to.be.true;
            expect(data.result.message).to.equal('Testing');
            expect(
              view.el.querySelector('.result-content').textContent
            ).to.match(/^Error: Testing/);
            expect(view.model.get('value')).to.equal(code);
            done();
          });

          view.setValue(code);
          view.execute();
        });

        it('should render asynchronous results', function (done) {
          var code = [
            'var done = async();',
            'setTimeout(function () {',
            '  done(null, "Testing");',
            '}, 0);'
          ].join('\n');

          view.on('execute', function (view, data) {
            expect(data.isError).to.be.false;
            expect(data.result).to.equal('Testing');
            expect(
              view.el.querySelector('.result-content').textContent
            ).to.equal('"Testing"');
            expect(view.model.get('value')).to.equal(code);
            expect(view.model.get('result')).to.equal('Testing');
            done();
          });

          view.setValue(code);
          view.execute();
        });

        it('should render asynchronous errors', function (done) {
          var code = [
            'var done = async();',
            'setTimeout(function () {',
            '  done(new Error("Testing"));',
            '}, 0);'
          ].join('\n');

          view.on('execute', function (view, data) {
            expect(data.isError).to.be.true;
            expect(data.result.message).to.equal('Testing');
            expect(
              view.el.querySelector('.result-content').textContent
            ).to.match(/^Error: Testing/);
            expect(view.model.get('value')).to.equal(code);
            done();
          });

          view.setValue(code);
          view.execute();
        });

        describe('Execute Code using clock', function () {
          var clock;
          beforeEach(function() {
            clock = sinon.useFakeTimers();
          });

          afterEach(function() {
            clock.restore();
          });

          it.skip('should have a failover system in case async is never resolved', function (done) {
            var spy   = sinon.spy(view, 'change');
            var code  = 'var done = async();';
            view.on('execute', function (view, data) {
              clock.restore();
              expect(spy).to.have.been.calledOnce;
              expect(view.model.get('value')).to.equal(code);
              done();
            });

            view.setValue(code);
            view.execute();

            App.nextTick(function () {
              clock.tick(60000);
              expect(spy).to.have.been.called;
            });
          });

          it.skip('should be able to change the timeout on the failover system', function (done) {
            var spy   = sinon.spy(view, 'change');
            var code  = 'timeout(5000);\nvar done = async();';
            view.on('execute', function (view, data) {
              clock.restore();
              expect(spy).to.have.been.calledOnce;
              expect(view.model.get('value')).to.equal(code);
              done();
            });

            view.setValue(code);
            view.execute();

            App.nextTick(function () {
              clock.tick(2500);
              expect(spy).to.not.have.been.called;
              clock.tick(3000);
              expect(spy).to.have.been.called;
            });
          });
        });

        it('should have a built in script loader', function (done) {
          var code   = 'load("' + FIXTURES_URL + '/test.js");';

          view.on('execute', function () {
            expect(view.notebook.sandbox.window.test).to.be.true;

            return done();
          });

          view.setValue(code);
          view.execute();
        });
      });

      it('should render an error when accesing to localStorage', function (done) {
        var code   = 'localStorage.getItem(\'ajs_user_traits\')';

        view.setValue(code);
        view.execute(function () {
          expect(view.model.get('isError')).to.be.true;
          return done();
        });
      });

      describe('Completion', function () {
        it('should complete from the sandbox', function (done) {
          view.notebook.sandbox.execute('var testing = "test";', function () {
            testCompletion(view.editor, 'test', function (results) {
              expect(results).to.contain('testing');
              return done();
            });
          });
        });
      });
    });
  });
});
