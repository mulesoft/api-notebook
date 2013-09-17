/* global App, afterEach, beforeEach, CustomEvent, describe, expect, it */

describe('Notebook', function () {
  var Notebook = App.View.Notebook;
  var fixture   = document.getElementById('fixture');

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

        expect(textCells[0].hasFocus()).to.be.ok;
        expect(textCells[0].editor.getCursor().ch).to.equal(4);
        expect(textCells[0].editor.getCursor().line).to.equal(3);
      });

      it('should be able to navigate down cells', function () {
        textCells[0].setValue('multi\nline\ncursor\ntest');
        codeCells[0].trigger('navigateDown', codeCells[0]);

        expect(textCells[0].hasFocus()).to.be.ok;
        expect(textCells[0].editor.getCursor().ch).to.equal(5);
        expect(textCells[0].editor.getCursor().line).to.equal(0);
      });

      it('should be able to move cells up', function () {
        codeCells[1].trigger('moveUp', codeCells[1]);

        expect(codeCells[1].hasFocus()).to.be.ok;
        expect(codeCells[1].el.nextSibling).to.equal(textCells[0].el);
        expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
        expect(textCells[0].el.nextSibling).to.not.exist;
      });

      it('should be able to move cells down', function () {
        codeCells[0].trigger('moveDown', codeCells[0]);

        expect(codeCells[0].hasFocus()).to.be.ok;
        expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
        expect(textCells[0].el.nextSibling).to.equal(codeCells[0].el);
      });

      it('should be able to clone a cell down', function () {
        textCells[0].setValue('testing');
        textCells[0].focus();
        textCells[0].editor.setCursor(0, 3);
        textCells[0].clone(); // Call the method since it will emit the event

        expect(textCells[0].el.nextSibling.className).to.contain('cell-text');
        expect(view.collection.at(3)).to.be.an.instanceof(App.Model.TextEntry);
        expect(view.collection.at(3).view.el.nextSibling).to.be.equal(codeCells[1].el);
        expect(view.collection.at(3).view.el.previousSibling).to.be.equal(textCells[0].el);
        expect(view.collection.at(3).view.hasFocus()).to.be.ok;
        expect(view.collection.at(3).view.editor.getCursor().ch).to.equal(3);
      });

      it('should be able to remove a node', function () {
        expect(view.collection.length).to.equal(4);

        codeCells[1].setValue('multi\nline');
        textCells[0].remove();

        expect(view.collection.length).to.equal(3);
        expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
        expect(codeCells[1].hasFocus()).to.be.ok;
        expect(codeCells[1].editor.getCursor().ch).to.equal(4);
        expect(codeCells[1].editor.getCursor().line).to.equal(1);
      });

      it('should be able to switch cell types', function () {
        expect(view.collection.length).to.equal(4);

        textCells[0].setValue('testing');
        textCells[0].focus();
        textCells[0].editor.setCursor(0, 5);
        textCells[0].trigger('switch', textCells[0]);

        expect(view.collection.length).to.equal(4);
        expect(textCells[0].el.parentNode).to.not.exist;
        expect(codeCells[0].el.nextSibling).to.equal(view.collection.at(2).view.el);
        expect(codeCells[1].el.previousSibling).to.equal(view.collection.at(2).view.el);
        expect(view.collection.at(2).view.hasFocus()).to.be.ok;
        expect(view.collection.at(2).view.editor.getCursor().ch).to.equal(5);
        expect(view.collection.at(2).view.editor.getCursor().line).to.equal(0);
      });

      it('should be able to reference previous results', function (done) {
        codeCells[0].on('execute', function (view, data) {
          codeCells[1].on('execute', function (view, data) {
            expect(data.result).to.equal(99);
            expect(data.isError).to.be.false;
            expect(codeCells[1].model.get('result')).to.equal(99);
            done();
          });

          expect(data.result).to.equal(99);
          expect(data.isError).to.be.false;
          expect(codeCells[0].model.get('result')).to.equal(99);

          codeCells[1].setValue('$1');
          codeCells[1].execute();
        });

        codeCells[0].setValue('99');
        codeCells[0].execute();
      });

      it('should execute all cells sequentially', function (done) {
        codeCells[0].setValue('3874');
        codeCells[1].setValue('$1');

        view.execute(function () {
          expect(codeCells[0].model.get('result')).to.equal(3874);
          expect(codeCells[1].model.get('result')).to.equal(3874);
          done();
        });
      });

      describe('Text Cell', function () {
        it('should remove itself when initializing a code cell', function () {
          expect(view.collection.length).to.equal(4);

          textCells[0].trigger('code', textCells[0]);

          expect(view.collection.length).to.equal(3);
          expect(textCells[0].el.parentNode).to.not.exist;
          expect(codeCells[0].el.nextSibling.className).to.contain('cell-code');
          expect(codeCells[0].el.nextSibling).to.equal(codeCells[1].el);
          expect(codeCells[1].hasFocus()).to.be.ok;
        });

        it('shouldn\'t remove itself when it has content', function () {
          expect(view.collection.length).to.equal(4);

          textCells[0].setValue('testing');
          textCells[0].trigger('code', textCells[0]);

          expect(view.collection.length).to.equal(4);
          expect(textCells[0].el.nextSibling).to.equal(codeCells[1].el);
          expect(codeCells[1].hasFocus()).to.be.ok;
        });

        it('should initialize the new cell with content when available', function () {
          textCells[0].trigger('code', textCells[0], 'testing');

          expect(view.collection.at(2).view.getValue()).to.equal('testing');
          expect(view.collection.at(2).view.hasFocus()).to.be.ok;
          expect(view.collection.at(2).view.editor.getCursor().ch).to.equal(7);
        });

        it('should append a new code view on blur if its the last cell', function (done) {
          textCells.push(view.appendTextView().focus());

          expect(view.collection.length).to.equal(5);
          expect(view.collection.at(4).get('type')).to.equal('text');

          setTimeout(function () {
            var input = document.createElement('input');
            fixture.appendChild(input);
            input.focus();
            fixture.removeChild(input);

            expect(view.collection.length).to.equal(6);
            expect(view.collection.at(5).get('type')).to.equal('code');
            done();
          }, 0);
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
          expect(view.collection.at(1).view.hasFocus()).to.be.ok;
        });

        it('shouldn\'t replace itself when it has content', function () {
          expect(view.collection.length).to.equal(4);

          codeCells[0].setValue('testing');
          codeCells[0].trigger('text', codeCells[0]);

          expect(view.collection.length).to.equal(5);
          expect(codeCells[0].el.nextSibling.className).to.contain('cell-text');
          expect(view.collection.at(2)).to.be.an.instanceof(App.Model.TextEntry);
          expect(view.collection.at(2).view.el.nextSibling).to.equal(textCells[0].el);
          expect(view.collection.at(2).view.hasFocus()).to.be.ok;
        });

        it('should initialize the new cell with content when available', function () {
          codeCells[0].trigger('text', codeCells[0], 'testing');

          expect(view.collection.at(1).view.getValue()).to.equal('testing');
          expect(view.collection.at(1).view.hasFocus()).to.be.ok;
          expect(view.collection.at(1).view.editor.getCursor().ch).to.equal(7);
        });

        it('should create a new view upon code execution', function () {
          expect(view.collection.length).to.equal(4);

          codeCells[1].trigger('execute', codeCells[1]);

          expect(view.collection.length).to.equal(5);
          expect(codeCells[1].el.nextSibling).to.equal(view.collection.at(4).view.el);
          expect(view.collection.at(4).view.hasFocus()).to.be.ok;
        });

        it('shouldn\'t create a new view if it\'s not the final cell', function () {
          expect(view.collection.length).to.equal(4);

          codeCells[0].trigger('execute', codeCells[0]);

          expect(view.collection.length).to.equal(4);
          expect(textCells[0].hasFocus()).to.be.ok;
        });

        it('should be able to browse to the cell above', function () {
          codeCells.push(view.appendCodeView());
          codeCells[2].focus();
          expect(codeCells[2].hasFocus()).to.be.ok;

          codeCells[0].setValue('one');
          codeCells[1].setValue('two');
          codeCells[2].setValue('three');

          codeCells[2].browseUp();
          expect(codeCells[2].editor.getValue()).to.equal('two');
          expect(codeCells[2].hasFocus()).to.be.ok;
          expect(codeCells[2].editor.getCursor().ch).to.equal(3);

          codeCells[2].browseUp();
          expect(codeCells[2].editor.getValue()).to.equal('one');
          expect(codeCells[2].hasFocus()).to.be.ok;
          expect(codeCells[2].editor.getCursor().ch).to.equal(3);
        });

        it('should be able to browse to the cell below', function () {
          codeCells.push(view.appendCodeView());
          codeCells[0].focus();
          expect(codeCells[0].hasFocus()).to.be.ok;

          codeCells[0].setValue('one');
          codeCells[1].setValue('two');
          codeCells[2].setValue('three');

          codeCells[0].browseDown();
          expect(codeCells[0].editor.getValue()).to.equal('two');
          expect(codeCells[0].hasFocus()).to.be.ok;
          expect(codeCells[0].editor.getCursor().ch).to.equal(3);

          codeCells[0].browseDown();
          expect(codeCells[0].editor.getValue()).to.equal('three');
          expect(codeCells[0].hasFocus()).to.be.ok;
          expect(codeCells[0].editor.getCursor().ch).to.equal(5);
        });

        it('should keep its value when browsing cells', function () {
          codeCells[1].focus();
          expect(codeCells[1].hasFocus()).to.be.ok;

          codeCells[0].setValue('one');
          codeCells[1].setValue('two');

          codeCells[0].browseDown();
          expect(codeCells[0].editor.getValue()).to.equal('two');

          codeCells[0].browseUp();
          expect(codeCells[0].editor.getValue()).to.equal('one');
        });

        it('should provide appropriate keyboard navigation between new content', function () {
          codeCells[0].setValue('multi\nline\ntest');
          codeCells[1].setValue('even\nmore\nlines\nhere');
          codeCells[1].focus();

          expect(codeCells[1].hasFocus()).to.be.ok;
          expect(codeCells[1].editor.getCursor().ch).to.equal(0);
          expect(codeCells[1].editor.getCursor().line).to.equal(0);

          codeCells[1].browseUp();
          expect(codeCells[1].editor.getCursor().ch).to.equal(4);
          expect(codeCells[1].editor.getCursor().line).to.equal(2);

          codeCells[1].browseDown();
          expect(codeCells[1].editor.getCursor().ch).to.equal(4);
          expect(codeCells[1].editor.getCursor().line).to.equal(0);
        });

        describe('Overlay Menu', function () {
          var getButton = function (cell) {
            return cell.el.getElementsByClassName('btn-show-cell-controls')[0];
          };

          var getMenu = function (cell) {
            return cell.el.getElementsByClassName('cell-controls')[0];
          };

          var simulateClick = function (element) {
            element.dispatchEvent(new CustomEvent('mousedown', true, true));
            element.dispatchEvent(new CustomEvent('mouseup', true, true));
            element.dispatchEvent(new CustomEvent('click', true, true));
          };

          it('should exist as one instance', function () {
            expect(view.controls).to.be.an('object');
          });

          it('should be appended to a cell when button is clicked', function() {
            var btn, menu;

            btn = getButton(codeCells[0]);
            expect(btn).to.be.ok;

            simulateClick(btn);
            menu = getMenu(codeCells[0]);

            expect(menu).to.be.ok;
          });

          // TODO: add tests to menu functions
          it.skip('should be able to move cells up');
          it.skip('should be able to move cells down');
          it.skip('should be able to move switch cell mode');
          it.skip('should be able to clone the cell');
          it.skip('should be able to delete the cell');
        });

        describe('Line numbers', function () {
          var getLineNumbers = function (view) {
            var nums = [];
            var els = view.el.getElementsByClassName('CodeMirror-linenumber');

            for (var i = 0; i < els.length; i++) {
              nums.push(els[i].firstChild.textContent);
            }

            return nums;
          };

          it('should continue line numbers from previous code cells', function () {
            expect(getLineNumbers(codeCells[0])[0]).to.equal('2');
            expect(getLineNumbers(codeCells[1])[0]).to.equal('3');
          });

          it('should continue line numbers when rearranged', function () {
            codeCells[0].moveDown();
            codeCells[0].moveDown();
            expect(getLineNumbers(codeCells[0])[0]).to.equal('3');
            expect(getLineNumbers(codeCells[1])[0]).to.equal('2');

            codeCells[0].moveUp();
            expect(getLineNumbers(codeCells[0])[0]).to.equal('2');
            expect(getLineNumbers(codeCells[1])[0]).to.equal('3');
          });

          it('should continue line numbers with different size cells', function () {
            codeCells[0].setValue('multi\nline\ntext');
            expect(getLineNumbers(codeCells[0])[0]).to.equal('2');
            expect(getLineNumbers(codeCells[0]).length).to.equal(3);
            expect(getLineNumbers(codeCells[1])[0]).to.equal('5');
          });

          it('should continue line numbers when rearranging multi line cells', function () {
            codeCells[0].setValue('look\nanother\nmulti\nline\ntest');
            expect(getLineNumbers(codeCells[0])[0]).to.equal('2');
            expect(getLineNumbers(codeCells[0]).length).to.equal(5);

            codeCells[0].moveDown();
            codeCells[0].moveDown();
            expect(getLineNumbers(codeCells[0])[0]).to.equal('3');
            expect(getLineNumbers(codeCells[1])[0]).to.equal('2');
          });
        });
      });
    });

    describe('Authentication integration', function () {
      it('should rerender the notebook when the user changes', function () {
        view.render().appendTo(fixture);

        var cell = view.appendCodeView();
        expect(cell.editor.options.readOnly).to.be.false;

        // Set different user and gist owners
        App.persistence.set('userId', 'test');
        expect(cell.editor.options.readOnly).to.equal('nocursor');

        view.remove();
      });
    });
  });
});
