/* global describe, it */

describe('Result Cell', function () {
  var Result    = App.View.ResultCell;
  var fixture = document.getElementById('fixture');

  it('should exist', function () {
    expect(Result).to.be.a('function');
  });

  describe('Result Cell instance', function () {
    var view;

    beforeEach(function () {
      view = new Result();
    });

    it('should have a class', function () {
      expect(view.el.className).to.contain('cell');
      expect(view.el.className).to.contain('cell-result');
      expect(view.el.className).to.contain('result-pending');
    });

    describe('#setResult', function () {
      it('should set the result', function (done) {
        view.setResult('Testing', false, window, function (err) {
          expect(err).to.not.exist;
          expect(view.el.className).to.not.contain('result-error');
          expect(view.el.className).to.not.contain('result-pending');
          expect(view.data.inspector).to.be.ok;
          expect(view.el.childNodes[0]).to.equal(view.data.inspector.el);
          done();
        });
      });

      it('should set an error', function (done) {
        view.setResult(new Error('Testing'), true, window, function (err) {
          expect(err).to.not.exist;
          expect(view.el.className).to.contain('result-error');
          expect(view.el.className).to.not.contain('result-pending');
          expect(view.data.inspector).to.be.ok;
          expect(view.el.childNodes[0]).to.equal(view.data.inspector.el);
          done();
        });
      });
    });

    describe('middleware', function () {
      it('should be able to hook onto the render', function (done) {
        var spy = sinon.spy(function (data, next, done) {
          data.el.appendChild(document.createTextNode('some testing here'));
          done();
        });

        App.middleware.use('result:render', spy);

        view.setResult(null, false, window, function () {
          expect(spy).to.have.been.calledOnce;
          expect(view.el.textContent).to.equal('some testing here');
          done();
        });
      });

      it('should be able to hook onto the clear method', function (done) {
        var spy = sinon.spy(function (data, next) {
          data.el.innerHTML = '';
          next();
        });

        App.middleware.use('result:empty', spy);

        view.setResult(null, true, window, function () {
          expect(spy).to.have.been.calledOnce;
          done();
        });
      });
    });
  });
});
