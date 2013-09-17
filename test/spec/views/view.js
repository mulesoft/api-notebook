/* global App, expect, beforeEach, describe, it */

describe('View', function () {
  var View    = App.View.View;
  var fixture = document.getElementById('fixture');

  it('should exist', function () {
    expect(View).to.be.a('function');
  });

  describe('View instance', function () {
    var view;

    beforeEach(function () {
      view = new View();
    });

    describe('#remove', function () {
      it('should emit an event', function () {
        var spy = sinon.spy();

        view.on('remove', spy);
        view.remove();

        expect(spy).to.have.been.calledOnce;
      });
    });

    describe('#appendTo', function () {
      it('should be able to append to an element', function () {
        view.appendTo(fixture);

        expect(view.el.parentNode).to.equal(fixture);
        view.remove();
      });

      it('should accept an function', function () {
        view.appendTo(function (el) {
          fixture.appendChild(el);
        });

        expect(view.el.parentNode).to.equal(fixture);
        view.remove();
      });
    });

    describe('#prependTo', function () {
      it('should be able to prepend to an element, putting the prepended ' +
        'element first in the child list', function () {
        var view2 = new View();
        view.prependTo(fixture);
        view2.prependTo(fixture);

        expect(view.el.parentNode).to.equal(fixture);
        expect(fixture.firstChild).to.equal(view2.el);
        view.remove();
        view2.remove();
      });
    });
  });
});
