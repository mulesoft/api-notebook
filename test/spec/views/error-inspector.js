/* global describe, it */

describe('Error Inspector', function () {
  var Inspector = App.View.ErrorInspector;

  it('should exist', function () {
    expect(Inspector).to.be.a('function');
  });

  describe('functionality', function () {
    var matchPreview = function (inspector, output) {
      var el = inspector.el.childNodes[1].getElementsByClassName('inspect')[0];
      if (output instanceof RegExp) {
        expect(el.textContent).to.match(output);
      } else {
        expect(el.textContent).to.equal(output);
      }
    };

    var inputOutput = function (input, output, done) {
      var inspector = new Inspector({ inspect: input, window: window });
      matchPreview(inspector.render(), output);
    };

    it('should inspect thrown errors', function () {
      try {
        throw new Error('Test Message');
      } catch (error) {
        inputOutput(error, 'Error: Test Message');
      }
    });
  });

  it('should be expandable', function () {
    expect(new Inspector({
      inspect: new Error('Test'),
      window:  window
    }).render().el.className).to.contain('can-expand');
  });

  it('should start non-exapanded', function () {
    expect(new Inspector({
      inspect: new Error('Test'),
      window:  window
    }).render().el.className).to.not.contain('open');
  });

  it('should open on click', function () {
    var view = new Inspector({
      inspect: new Error('Test'),
      window:  window
    }).render();

    expect(view.el.className).to.not.contain('open');
    view.open();
    expect(view.el.className).to.contain('open');

    expect(
      view.el.getElementsByClassName('children')[0].children.length
    ).to.be.gt(0);
  });
});
