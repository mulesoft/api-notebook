/* global App, afterEach, beforeEach, describe, expect, it */

describe('Notebook', function () {
  var Notebook = App.View.Notebook;
  var fixture   = document.getElementById('fixture');

  it('should exist', function () {
    expect(Notebook).to.be.a('function');
  });

  describe('Cell instance', function () {
    var view;

    beforeEach(function () {
      var model = new App.Model.Notebook();
      view = new Notebook({ model: model });
      App.persistence.set('notebook', model);
    });

    afterEach(function () {
      view.remove();
    });

    it('should have a class', function () {
      expect(view.el.className).to.equal('notebook-view');
    });

    describe('#appendView', function () {
      it('should append the view element to the notebook', function () {
        view.appendView(new App.View.CodeCell({
          notebook: view
        }));

        expect(view.el.childNodes.length).to.equal(1);
        expect(view.el.childNodes[0].className).to.contain('cell-code');
      });

      it('should add the models view to the collection', function () {
        var cell = new App.View.CodeCell({
          notebook: view
        });

        view.appendView(cell);

        expect(view.collection.length).to.equal(1);
        expect(view.collection.at(0)).to.equal(cell.model);
      });

      it('should add a reference back to the view from the model', function () {
        var cell = new App.View.CodeCell({
          notebook: view
        });

        view.appendView(cell);

        expect(cell.model.view).to.equal(cell);
      });

      it('should accept a custom before element', function () {
        var cell1 = new App.View.CodeCell({ notebook: view });
        var cell2 = new App.View.CodeCell({ notebook: view });
        var cell3 = new App.View.CodeCell({ notebook: view });

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
        view      = view.render().appendTo(fixture);
        textCells = [];
        codeCells = [];

        // Append some initial testing cells
        codeCells.push(view.appendCodeView());
        textCells.push(view.appendTextView());
        codeCells.push(view.appendCodeView());
      });

      it('should be able to navigate up cells', function () {
        textCells[0].setValue('multi\nline\ncursor\ntest');
        codeCells[1].trigger('browseUp', codeCells[1]);

        expect(textCells[0].hasFocus()).to.be.ok;
        expect(textCells[0].editor.getCursor().line).to.equal(3);
      });

      it('should be able to navigate down cells', function () {
        textCells[0].setValue('multi\nline\ncursor\ntest');
        codeCells[0].trigger('browseDown', codeCells[0]);

        expect(textCells[0].hasFocus()).to.be.ok;
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
        textCells[0].clone();

        expect(textCells[0].el.nextSibling.className).to.contain('cell-text');
        expect(view.collection.at(3).get('type')).to.equal('text');
        expect(view.collection.at(3).view.el.nextSibling).to.be.equal(codeCells[1].el);
        expect(view.collection.at(3).view.el.previousSibling).to.be.equal(textCells[0].el);
        expect(view.collection.at(3).view.hasFocus()).to.be.ok;
        expect(view.collection.at(3).view.editor.getCursor().ch).to.equal(3);
      });

      it('should be able to remove a node', function () {
        expect(view.collection.length).to.equal(4);

        codeCells[1].setValue('multi\nline');
        textCells[0].delete();

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
          return done();
        });
      });

      it('should be able to prepend a code cell', function (done) {
        expect(view.collection.length).to.equal(4);

        var viewIndex = view.collection.indexOf(codeCells[0].model);
        var topBorder = codeCells[0].el.querySelector('.cell-border-above');
        var clock     = sinon.useFakeTimers();

        simulateEvent(topBorder, 'mouseenter');
        clock.tick(1000);

        App.Library.DOMBars.VM.exec(function () {
          clock.restore();

          simulateEvent(topBorder.querySelector('[data-action="newCode"]'), 'click');

          expect(view.collection.at(viewIndex).get('type')).to.equal('code');
          expect(view.collection.length).to.equal(5);

          return done();
        });
      });

      it('should be able to prepend a text cell', function (done) {
        expect(view.collection.length).to.equal(4);

        var viewIndex = view.collection.indexOf(codeCells[0].model);
        var topBorder = codeCells[0].el.querySelector('.cell-border-above');
        var clock     = sinon.useFakeTimers();

        simulateEvent(topBorder, 'mouseenter');
        clock.tick(1000);

        App.Library.DOMBars.VM.exec(function () {
          clock.restore();

          simulateEvent(topBorder.querySelector('[data-action="newText"]'), 'click');

          expect(view.collection.at(viewIndex).get('type')).to.equal('text');
          expect(view.collection.length).to.equal(5);

          return done();
        });
      });

      it('should be able to append a code cell', function (done) {
        expect(view.collection.length).to.equal(4);

        var viewIndex = view.collection.indexOf(codeCells[0].model) + 1;
        var topBorder = codeCells[0].el.querySelector('.cell-border-below');
        var clock     = sinon.useFakeTimers();

        simulateEvent(topBorder, 'mouseenter');
        clock.tick(1000);

        App.Library.DOMBars.VM.exec(function () {
          clock.restore();

          simulateEvent(topBorder.querySelector('[data-action="newCode"]'), 'click');

          expect(view.collection.at(viewIndex).get('type')).to.equal('code');
          expect(view.collection.length).to.equal(5);

          return done();
        });
      });

      it('should be able to append a text cell', function (done) {
        expect(view.collection.length).to.equal(4);

        var viewIndex = view.collection.indexOf(codeCells[0].model) + 1;
        var topBorder = codeCells[0].el.querySelector('.cell-border-below');
        var clock     = sinon.useFakeTimers();

        simulateEvent(topBorder, 'mouseenter');
        clock.tick(1000);

        App.Library.DOMBars.VM.exec(function () {
          clock.restore();

          simulateEvent(topBorder.querySelector('[data-action="newText"]'), 'click');

          expect(view.collection.at(viewIndex).get('type')).to.equal('text');
          expect(view.collection.length).to.equal(5);

          return done();
        });
      });

      describe('Text Cell', function () {
        it('should append a new code view on blur if its the last cell', function (done) {
          textCells.push(view.appendTextView().focus());

          expect(view.collection.length).to.equal(5);
          expect(view.collection.at(4).get('type')).to.equal('text');

          App.nextTick(function () {
            expect(view.collection.at(4).view.editor.hasFocus()).to.be.true;

            var input = document.createElement('input');
            fixture.appendChild(input);
            input.focus();
            fixture.removeChild(input);

            setTimeout(function () {
              expect(view.collection.length).to.equal(6);
              expect(view.collection.at(5).get('type')).to.equal('code');
              return done();
            }, 20);
          });
        });
      });

      describe('Code Cell', function () {
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

        it('should be able to do completion based on context', function (done) {
          testCompletion(codeCells[0].editor, 'win', function (results) {
            expect(results).to.contain('window');
            return done();
          });
        });

        describe('Overlay Menu', function () {
          var getButton = function (cell) {
            return cell.el.querySelector('.cell-controls-btn');
          };

          var getMenu = function (cell) {
            return cell.el.querySelector('.cell-controls');
          };

          it('should be appended to a cell when button is clicked', function() {
            var btn, menu;

            btn = getButton(codeCells[0]);
            expect(btn).to.be.ok;

            simulateEvent(btn, 'mousedown');
            menu = getMenu(codeCells[0]);

            expect(menu).to.be.ok;
          });

          describe('Functionality', function () {
            var menu;

            beforeEach(function () {
              simulateEvent(getButton(codeCells[0]), 'mousedown');
              menu = codeCells[0].el.querySelector('.cell-controls');
            });

            it('should be able to move cells up', function () {
              expect(view.collection.at(1)).to.equal(codeCells[0].model);

              var btn = menu.querySelector('[data-action="moveUp"]');
              simulateEvent(btn, 'mousedown');

              expect(view.collection.at(0)).to.equal(codeCells[0].model);
            });

            it('should be able to move cells down', function () {
              expect(view.collection.at(1)).to.equal(codeCells[0].model);

              var btn = menu.querySelector('[data-action="moveDown"]');
              simulateEvent(btn, 'mousedown');

              expect(view.collection.at(2)).to.equal(codeCells[0].model);
            });

            it('should be able to move switch cell mode', function () {
              expect(view.collection.at(1).get('type')).to.equal('code');

              var btn = menu.querySelector('[data-action="switch"]');
              simulateEvent(btn, 'mousedown');

              expect(view.collection.at(1).get('type')).to.equal('text');
            });

            it('should be able to clone the cell', function () {
              expect(view.collection.length).to.equal(4);
              expect(view.collection.at(1)).to.equal(codeCells[0].model);

              codeCells[0].setValue('testing');

              var btn = menu.querySelector('[data-action="clone"]');
              simulateEvent(btn, 'mousedown');

              expect(view.collection.length).to.equal(5);
              expect(view.collection.at(2).view.getValue()).to.equal('testing');
            });

            it('should be able to delete the cell', function () {
              expect(view.collection.length).to.equal(4);
              expect(view.collection.at(1)).to.equal(codeCells[0].model);

              var btn = menu.querySelector('[data-action="delete"]');
              simulateEvent(btn, 'mousedown');

              expect(view.collection.length).to.equal(3);
              expect(view.collection.at(1)).to.not.equal(codeCells[0].model);
            });

            it('should create a new cell below', function () {
              expect(view.collection.length).to.equal(4);
              expect(view.collection.at(2)).to.equal(textCells[0].model);

              var btn = menu.querySelector('[data-action="appendNew"]');
              simulateEvent(btn, 'mousedown');

              expect(view.collection.length).to.equal(5);
              expect(view.collection.at(2)).to.not.equal(textCells[0].model);
            });
          });
        });
      });
    });
  });
});
