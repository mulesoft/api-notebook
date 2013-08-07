/* global describe, it */

describe('View', function () {
  var View = App.View.View;

  it('should exist', function () {
    expect(View).to.be.a('function');
  });

  describe('View instance', function () {
    var view;

    beforeEach(function () {
      view = new View();
    });

    describe('#remove', function () {
      it('should remove all event listeners', function () {
        view.on('test', function () {});

        expect(view._events).to.be.an('object');
        expect(view._events.test).to.exist;

        view.remove();

        expect(view._events.test).to.not.exist;
      });

      it('should emit an event', function () {
        var spy = sinon.spy();

        view.on('remove', spy);

        view.remove();

        expect(spy.calledOnce).to.be.ok;
      });
    });

    describe('#appendTo', function () {
      var fixture = document.getElementById('fixture');

      it('should be able to append to an element', function () {
        view.appendTo(fixture);

        expect(view.el.parentNode).to.equal(fixture);
      });

      it('should accept an function', function () {
        view.appendTo(function (el) {
          fixture.appendChild(el);
        });

        expect(view.el.parentNode).to.equal(fixture);
      });
    });
  });
});
