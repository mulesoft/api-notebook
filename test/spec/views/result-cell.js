/* global describe, it, beforeEach */

describe('Result Cell', function () {
  var Result    = App.View.ResultCell;
  var Backbone  = App.Library.Backbone;
  var fixture   = document.getElementById('fixture');

  it('should exist', function () {
    expect(Result).to.be.a('function');
  });

  describe('Result Cell instance', function () {
    it('should have a class', function () {
      var view = new Result({
        model: new Backbone.Model()
      });

      expect(view.el.className).to.contain('cell');
      expect(view.el.className).to.contain('cell-result');
      expect(view.el.className).to.contain('result-pending');
    });

    describe('#render', function () {
      it('should set the result', function () {
        var view = new Result({
          model: new Backbone.Model({
            result:  'Testing',
            isError: false
          })
        }).render().change();

        expect(view.el.className).to.not.contain('result-error');
        expect(view.el.className).to.not.contain('result-pending');
      });

      it('should set an error', function () {
        var view = new Result({
          model: new Backbone.Model({
            result:  new Error('Testing'),
            isError: true
          })
        }).render().change();

        expect(view.el.className).to.contain('result-error');
        expect(view.el.className).to.not.contain('result-pending');
      });
    });

    describe('middleware', function () {
      it('should be able to hook onto the render', function () {
        var removeSpy = sinon.spy();

        var renderSpy = sinon.spy(function (data, next, done) {
          data.el.appendChild(document.createTextNode('some testing here'));
          return done(null, removeSpy);
        });

        App.middleware.register('result:render', renderSpy);

        var view = new Result({
          model: new Backbone.Model({
            result:  null,
            isError: false
          })
        }).render().change();

        expect(renderSpy).to.have.been.calledOnce;
        expect(
          view.el.querySelector('.result-content').textContent
        ).to.equal('some testing here');

        view.remove();
        expect(removeSpy).to.have.been.calledOnce;
      });
    });
  });
});
