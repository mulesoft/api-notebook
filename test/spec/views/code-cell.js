/* global describe, it */

describe('Code Cell', function () {
  var Code    = App.View.CodeCell;
  var fixture = document.getElementById('fixture');

  it('should exist', function () {
    expect(Code).to.be.a('function');
  });

  describe('Code Cell instance', function () {
    var view;

    beforeEach(function () {
      view = new Code();
      view.model.view = view;
      view.sandbox    = new App.Sandbox();
      view.model.collection = {
        indexOf:     sinon.stub().returns(0),
        getNextCode: sinon.stub().returns(undefined),
        getPrevCode: sinon.stub().returns(undefined)
      };
    });

    it('should have a class', function () {
      expect(view.el.className).to.contain('cell');
      expect(view.el.className).to.contain('cell-code');
    });

    describe('#render', function () {
      beforeEach(function () {
        view = view.render();
      });

      it('should append a result view', function () {
        expect(view.resultCell).to.be.an.instanceof(App.View.ResultCell);
      });
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
        expect(editor.getOption('mode')).to.equal('javascript');
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
          var spy  = sinon.spy(view.resultCell, 'setResult');
          var code = '10';

          view.on('execute', function (view, data) {
            expect(data.result).to.equal(10);
            expect(data.isError).to.be.false;
            expect(spy).to.have.been.calledOnce;
            expect(view.model.get('value')).to.equal(code);
            expect(view.model.get('result')).to.equal(10);
            done();
          });

          editor.setValue(code);
          view.execute();
        });

        it('should render an error', function (done) {
          var spy  = sinon.spy(view.resultCell, 'setResult');
          var code = 'throw new Error(\'Testing\');';

          view.on('execute', function (view, data) {
            expect(data.isError).to.be.true;
            expect(data.result.message).to.equal('Testing');
            expect(spy).to.have.been.calledOnce;
            expect(view.model.get('value')).to.equal(code);
            expect(view.model.get('result')).to.not.exist;
            done();
          });

          editor.setValue(code);
          view.execute();
        });

        it('should render asynchronous results', function (done) {
          var spy  = sinon.spy(view.resultCell, 'setResult');
          var code = [
            'var done = async();',
            'setTimeout(function () {',
            '  done(null, "Testing");',
            '}, 0);'
          ].join('\n');

          view.on('execute', function (view, data) {
            expect(data.isError).to.be.false;
            expect(data.result).to.equal('Testing');
            expect(spy).to.have.been.calledOnce;
            expect(view.model.get('value')).to.equal(code);
            expect(view.model.get('result')).to.equal('Testing');
            done();
          });

          editor.setValue(code);
          view.execute();
        });

        it('should render asynchronous errors', function (done) {
          var spy  = sinon.spy(view.resultCell, 'setResult');
          var code = [
            'var done = async();',
            'setTimeout(function () {',
            '  done(new Error("Testing"));',
            '}, 0);'
          ].join('\n');

          view.on('execute', function (view, data) {
            expect(data.isError).to.be.true;
            expect(data.result.message).to.equal('Testing');
            expect(spy).to.have.been.calledOnce;
            expect(view.model.get('value')).to.equal(code);
            expect(view.model.get('result')).to.not.exist;
            done();
          });

          editor.setValue(code);
          view.execute();
        });

        it('should have a failover system in case async is never resolved', function (done) {
          var spy   = sinon.spy(view.resultCell, 'setResult');
          var code  = 'var done = async();';
          var clock = sinon.useFakeTimers();

          view.on('execute', function (view, data) {
            clock.restore();
            expect(spy).to.have.been.calledOnce;
            expect(view.model.get('value')).to.equal(code);
            done();
          });

          editor.setValue(code);
          view.execute();

          App.nextTick(function () {
            clock.tick(2000);
          }, 20);
        });

        it('should be able to change the timeout on the failover system', function (done) {
          var spy   = sinon.spy(view.resultCell, 'setResult');
          var code  = 'timeout = 5000;\nvar done = async();';
          var clock = sinon.useFakeTimers();

          view.on('execute', function (view, data) {
            clock.restore();
            expect(spy).to.have.been.calledOnce;
            expect(view.model.get('value')).to.equal(code);
            done();
          });

          editor.setValue(code);
          view.execute();

          App.nextTick(function () {
            clock.tick(2000);
            expect(spy).to.not.have.been.called;
            clock.tick(3000);
          });
        });
      });

      describe('Comment Block', function () {
        it('should open a text cell and execute the current content', function () {
          var textSpy = sinon.spy(function (view, text) {
            expect(text).to.equal('testing');
          });
          var executeSpy = sinon.spy(view, 'execute');

          view.on('text', textSpy);

          editor.setValue('abc /* testing');
          expect(textSpy).to.have.been.calledOnce;
          expect(executeSpy).to.have.been.calledOnce;
          expect(editor.getValue()).to.equal('abc');
          expect(view.model.get('value')).to.equal('abc');
        });
      });

      describe('Completion', function () {
        it('should complete from the sandbox', function (done) {
          view.sandbox.execute('var testing = "test";', function () {
            testCompletion(view.editor, 'test', function (results) {
              expect(results).to.contain('testing');
              done();
            });
          });
        });
      });
    });
  });
});
