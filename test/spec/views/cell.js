/* global describe, it */

describe('Cell', function () {
  var Cell = App.View.Cell;

  it('should exist', function () {
    expect(Cell).to.be.a('function');
  });

  describe('Cell instance', function () {
    var view;

    beforeEach(function () {
      view = new Cell();
    });

    it('should have a class', function () {
      expect(view.el.className).to.equal('cell');
    });
  });
});
