/* global describe, it */

describe('Notebook', function () {
  var Notebook = App.View.Notebook;

  it('should exist', function () {
    expect(Notebook).to.be.a('function');
  });

  describe('Cell instance', function () {
    var view;

    beforeEach(function () {
      view = new Notebook();
    });

    it('should have a class', function () {
      expect(view.el.className).to.equal('notebook');
    });

    describe('#initialize', function () {
      it('should have a new collection set', function () {
        expect(view.collection).to.be.ok;
        expect(view.collection.length).to.be.equal(0);
      });
    });

    describe('#appendTo', function () {
      beforeEach(function () {
        view = view.render().appendTo(fixture);
      });

      afterEach(function () {
        view.remove();
      });

      it('should append an initial code view', function () {
        expect(view.el.childNodes.length).to.equal(1);
        expect(view.el.childNodes[0].className).to.contain('cell-code');
      });
    });

    describe('#appendView', function () {
      it('should append the view element to the notebook', function () {
        view.appendView(new App.View.CodeCell());

        expect(view.el.childNodes.length).to.equal(1);
        expect(view.el.childNodes[0].className).to.contain('cell-code');
      });

      it('should add the models view to the collection', function () {
        var cell = new App.View.CodeCell();

        view.appendView(cell);

        expect(view.collection.length).to.equal(1);
        expect(view.collection.at(0)).to.equal(cell.model);
      });

      it('should add a reference back to the view from the model', function () {
        var cell = new App.View.CodeCell();

        view.appendView(cell);

        expect(cell.model.view).to.equal(cell);
      });

      it('should accept a custom before element', function () {
        var cell1 = new App.View.CodeCell();
        var cell2 = new App.View.CodeCell();
        var cell3 = new App.View.CodeCell();

        view.appendView(cell1);
        view.appendView(cell2);
        // After `cell1`
        view.appendView(cell3, cell1.el);

        expect(cell3.el.parentNode).to.equal(view.el);
        expect(cell3.el.nextSibling).to.equal(cell2.el);
      })
    });

    describe('#appendCodeView', function () {
      it('should append a new code view', function () {
        view.appendCodeView();

        expect(view.el.childNodes.length).to.equal(1);
        expect(view.el.childNodes[0].className).to.contain('cell-code');
      });

      it('should accept an element to append after', function () {
        var cell1 = view.appendCodeView();
        var cell2 = view.appendCodeView();
        var cell3 = view.appendCodeView(cell1.el);

        expect(view.el.childNodes.length).to.equal(3);
        expect(cell3.el.nextSibling).to.equal(cell2.el);
      });

      it('should accept a starting text value', function () {
        var cell = view.appendCodeView(null, 'testing');

        expect(cell.getValue()).to.equal('testing');
      });
    });

    describe('#appendTextView', function () {
      it('should append a new text view', function () {
        view.appendTextView();

        expect(view.el.childNodes.length).to.equal(1);
        expect(view.el.childNodes[0].className).to.contain('cell-text');
      });

      it('should accept an element to append after', function () {
        var cell1 = view.appendTextView();
        var cell2 = view.appendTextView();
        var cell3 = view.appendTextView(cell1.el);

        expect(view.el.childNodes.length).to.equal(3);
        expect(cell3.el.nextSibling).to.equal(cell2.el);
      });

      it('should accept a starting text value', function () {
        var cell = view.appendTextView(null, 'testing');

        expect(cell.getValue()).to.equal('testing');
      });
    });

    describe('Working with the Notebook', function () {
      var textCells;
      var codeCells;

      beforeEach(function () {
        view = view.render().appendTo(fixture);
        textCells = [];
        codeCells = [];
        // Append some initial testing cells
        codeCells.push(view.appendCodeView());
        textCells.push(view.appendTextView());
        codeCells.push(view.appendCodeView());
      });

      afterEach(function () {
        view.remove();
      });

      it('should be able to navigate up cells', function () {
        textCells[0].setValue('multi\nline\ncursor\ntest');
        codeCells[1].trigger('navigateUp', codeCells[1]);

        expect(textCells[0].editor.hasFocus()).to.be.ok;
        expect(textCells[0].editor.getCursor().ch).to.equal(4);
        expect(textCells[0].editor.getCursor().line).to.equal(3);
      });

      it('should be able to navigate down cells', function () {
        textCells[0].setValue('multi\nline\ncursor\ntest');
        codeCells[0].trigger('navigateDown', codeCells[0]);

        expect(textCells[0].editor.hasFocus()).to.be.ok;
        expect(textCells[0].editor.getCursor().ch).to.equal(5);
        expect(textCells[0].editor.getCursor().line).to.equal(0);
      });

      it('should be able to move cells up', function () {
        codeCells[1].trigger('moveUp', codeCells[1]);

        expect(codeCells[1].editor.hasFocus()).to.be.ok;
        expect(codeCells[1].el.nextSibling).to.equal(textCells[0].el);
        expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
        expect(textCells[0].el.nextSibling).to.not.exist;
      });

      it('should be able to move cells down', function () {
        codeCells[0].trigger('moveDown', codeCells[0]);

        expect(codeCells[0].editor.hasFocus()).to.be.ok;
        expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
        expect(textCells[0].el.nextSibling).to.equal(codeCells[0].el);
      });

      it('should be able to clone a cell down', function () {
        textCells[0].setValue('testing');
        textCells[0].editor.setCursor(0, 3);
        textCells[0].clone(); // Call the method since it will emit the event

        expect(textCells[0].el.nextSibling.className).to.contain('cell-text');
        expect(view.collection.at(3)).to.be.an.instanceof(App.Model.TextEntry);
        expect(view.collection.at(3).view.el.nextSibling).to.be.equal(codeCells[1].el);
        expect(view.collection.at(3).view.el.previousSibling).to.be.equal(textCells[0].el);
        expect(view.collection.at(3).view.editor.hasFocus()).to.be.ok;
        expect(view.collection.at(3).view.editor.getCursor().ch).to.equal(3);
      });

      it('should be able to remove a node', function () {
        expect(view.collection.length).to.equal(4);

        codeCells[1].setValue('multi\nline');
        textCells[0].remove();

        expect(view.collection.length).to.equal(3);
        expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
        expect(codeCells[1].editor.hasFocus()).to.be.ok;
        expect(codeCells[1].editor.getCursor().ch).to.equal(4);
        expect(codeCells[1].editor.getCursor().line).to.equal(1);
      });

      it('should be able to switch cell types', function () {
        expect(view.collection.length).to.equal(4);

        textCells[0].setValue('testing');
        textCells[0].editor.setCursor(0, 5);
        textCells[0].trigger('switch', textCells[0]);

        expect(view.collection.length).to.equal(4);
        expect(textCells[0].el.parentNode).to.not.exist;
        expect(codeCells[0].el.nextSibling).to.equal(view.collection.at(2).view.el);
        expect(codeCells[1].el.previousSibling).to.equal(view.collection.at(2).view.el);
        expect(view.collection.at(2).view.editor.hasFocus()).to.be.ok;
        expect(view.collection.at(2).view.editor.getCursor().ch).to.equal(5);
        expect(view.collection.at(2).view.editor.getCursor().line).to.equal(0);
      });

      it('should be able to reference previous results', function () {
        var spy = sinon.spy(function (view, err, result) {
          expect(result).to.equal(99);
        });

        codeCells[0].setValue(99);
        codeCells[0].execute();

        codeCells[1].setValue('$1');
        codeCells[1].on('execute', spy);
        codeCells[1].execute();

        expect(spy).to.have.been.called;
      });

      describe('Text Cell', function () {
        it('should remove itself when initializing a code cell', function () {
          expect(view.collection.length).to.equal(4);

          textCells[0].trigger('code', textCells[0]);

          expect(view.collection.length).to.equal(3);
          expect(textCells[0].el.parentNode).to.not.exist;
          expect(codeCells[0].el.nextSibling.className).to.contain('cell-code');
          expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
          expect(codeCells[1].editor.hasFocus()).to.be.ok;
        });

        it('shouldn\'t remove itself when it has content', function () {
          expect(view.collection.length).to.equal(4);

          textCells[0].setValue('testing');
          textCells[0].trigger('code', textCells[0]);

          expect(view.collection.length).to.equal(4);
          expect(textCells[0].el.nextSibling).to.equal(codeCells[1].el);
          expect(codeCells[1].editor.hasFocus()).to.be.ok;
        });

        it('should initialize the new cell with content when available', function () {
          textCells[0].trigger('code', textCells[0], 'testing');

          expect(view.collection.at(2).view.getValue()).to.equal('testing');
          expect(view.collection.at(2).view.editor.hasFocus()).to.be.ok;
          expect(view.collection.at(2).view.editor.getCursor().ch).to.equal(7);
        });
      });

      describe('Code Cell', function () {
        it('should replace itself when initializing a text cell', function () {
          expect(view.collection.length).to.equal(4);

          codeCells[0].trigger('text', codeCells[0]);

          // Removes the empty cell actively converting it into a text node
          expect(view.collection.length).to.equal(4);
          expect(codeCells[0].el.parentNode).to.not.exist;
          expect(textCells[0].el.previousSibling.className).to.contain('cell-text');
          expect(view.collection.at(1)).to.be.an.instanceof(App.Model.TextEntry);
          expect(view.collection.at(1).view.el.nextSibling).to.equal(textCells[0].el);
          expect(view.collection.at(1).view.editor.hasFocus()).to.be.ok;
        });

        it('shouldn\'t replace itself when it has content', function () {
          expect(view.collection.length).to.equal(4);

          codeCells[0].setValue('testing');
          codeCells[0].trigger('text', codeCells[0]);

          expect(view.collection.length).to.equal(5);
          expect(codeCells[0].el.nextSibling.className).to.contain('cell-text');
          expect(view.collection.at(2)).to.be.an.instanceof(App.Model.TextEntry);
          expect(view.collection.at(2).view.el.nextSibling).to.equal(textCells[0].el);
          expect(view.collection.at(2).view.editor.hasFocus()).to.be.ok;
        });

        it('should initialize the new cell with content when available', function () {
          codeCells[0].trigger('text', codeCells[0], 'testing');

          expect(view.collection.at(1).view.getValue()).to.equal('testing');
          expect(view.collection.at(1).view.editor.hasFocus()).to.be.ok;
          expect(view.collection.at(1).view.editor.getCursor().ch).to.equal(7);
        });

        it('should create a new view upon code execution', function () {
          expect(view.collection.length).to.equal(4);

          codeCells[1].trigger('execute', codeCells[1]);

          expect(view.collection.length).to.equal(5);
          expect(codeCells[1].el.nextSibling).to.equal(view.collection.at(4).view.el);
          expect(view.collection.at(4).view.editor.hasFocus()).to.be.ok;
        });

        it('shouldn\'t create a new view if it\'s not the final cell', function () {
          expect(view.collection.length).to.equal(4);

          codeCells[0].trigger('execute', codeCells[0]);

          expect(view.collection.length).to.equal(4);
          expect(textCells[0].editor.hasFocus()).to.be.ok;
        });

        it('should be able to browse to the cell above', function () {
          codeCells.push(view.appendCodeView());
          expect(codeCells[2].editor.hasFocus()).to.be.ok;

          codeCells[0].setValue('one');
          codeCells[1].setValue('two');
          codeCells[2].setValue('three');

          codeCells[2].browseUp();
          expect(codeCells[2].getValue()).to.equal('two');
          expect(codeCells[2].editor.hasFocus()).to.be.ok;
          expect(codeCells[2].editor.getCursor().ch).to.equal(3);

          codeCells[2].browseUp();
          expect(codeCells[2].getValue()).to.equal('one');
          expect(codeCells[2].editor.hasFocus()).to.be.ok;
          expect(codeCells[2].editor.getCursor().ch).to.equal(3);
        });

        it('should be able to browse to the cell below', function () {
          codeCells.push(view.appendCodeView());
          codeCells[0].focus();
          expect(codeCells[0].editor.hasFocus()).to.be.ok;

          codeCells[0].setValue('one');
          codeCells[1].setValue('two');
          codeCells[2].setValue('three');

          codeCells[0].browseDown();
          expect(codeCells[0].getValue()).to.equal('two');
          expect(codeCells[0].editor.hasFocus()).to.be.ok;
          expect(codeCells[0].editor.getCursor().ch).to.equal(3);

          codeCells[0].browseDown();
          expect(codeCells[0].getValue()).to.equal('three');
          expect(codeCells[0].editor.hasFocus()).to.be.ok;
          expect(codeCells[0].editor.getCursor().ch).to.equal(5);
        });

        it('should keep its value when browsing cells', function () {
          expect(codeCells[1].editor.hasFocus()).to.be.ok;

          codeCells[0].setValue('one');
          codeCells[1].setValue('two');

          codeCells[0].browseDown();
          expect(codeCells[0].getValue()).to.equal('two');

          codeCells[0].browseUp();
          expect(codeCells[0].getValue()).to.equal('one');
        });

        it('should provide appropriate keyboard navigation between new content', function () {
          codeCells[0].setValue('multi\nline\ntest');
          codeCells[1].setValue('even\nmore\nlines\nhere');

          expect(codeCells[1].editor.hasFocus()).to.be.ok;
          expect(codeCells[1].editor.getCursor().ch).to.equal(0);
          expect(codeCells[1].editor.getCursor().line).to.equal(0);

          codeCells[1].browseUp();
          expect(codeCells[1].editor.getCursor().ch).to.equal(4);
          expect(codeCells[1].editor.getCursor().line).to.equal(2);

          codeCells[1].browseDown();
          expect(codeCells[1].editor.getCursor().ch).to.equal(4);
          expect(codeCells[1].editor.getCursor().line).to.equal(0);
        });

        it('should be able to reference previous results', function () {
          codeCells[0].setValue('8342');
          codeCells[1].setValue('$1');

          codeCells[0].execute();
          codeCells[1].execute();

          expect(codeCells[0].model.get('result')).to.equal(8342);
          expect(codeCells[1].model.get('result')).to.equal(8342);
        });
      });
    });
  });
});
