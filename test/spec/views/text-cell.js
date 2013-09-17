/* global describe, it */

describe('Text Cell', function () {
  var Text    = App.View.TextCell;
  var fixture = document.getElementById('fixture');

  it('should exist', function () {
    expect(Text).to.be.a('function');
  });

  describe('Text Cell instance', function () {
    var view;

    beforeEach(function () {
      view = new Text();
    });

    it('should have a class', function () {
      expect(view.el.className).to.contain('cell');
      expect(view.el.className).to.contain('cell-text');
    });

    describe('Using the editor', function () {
      var editor;

      beforeEach(function () {
        view   = view.render().appendTo(fixture).focus();
        editor = view.editor;
      });

      afterEach(function () {
        view.remove();
      });

      it('should be a markdown editor', function () {
        expect(editor.getOption('mode')).to.equal('gfm');
      });

      describe('end comment block', function () {
        it('should open a new cell at the end of a block comment', function () {
          var spy = sinon.spy(function (view, code) {
            expect(code).to.equal('testing');
          });
          view.on('code', spy);
          editor.setValue('abc */ testing');
          expect(spy).to.have.been.calledOnce;
          expect(editor.getValue()).to.equal('abc');
          expect(view.model.get('value')).to.equal('abc');
        });
      });
    });
  });
});
