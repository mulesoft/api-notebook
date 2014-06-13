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

      describe('Focus Position', function () {
        /**
         * Get the correct node and offset for a character position.
         *
         * @param  {Element} node
         * @param  {Number}  offset
         * @return {Object}
         */
        var getElPositions = function (node, offset) {
          while (true) {
            // Skip whitespace node injected by the markdown parsing.
            if (
                node.nodeType === 8 ||
                (node.nodeType === 3 && /^\s*$/.test(node.textContent))
              ) {
              node = node.nextSibling;
              continue;
            }

            if (offset > node.textContent.length) {
              offset -= node.textContent.length;
              node = node.nextSibling;
              continue;
            }

            if (node.nodeType !== 3) {
              node = node.firstChild;
              continue;
            }

            break;
          }

          return {
            node:   node,
            offset: offset
          }
        };

        /**
         * Check that clicking a text cell focuses on the expected position.
         *
         * @param  {String}   text
         * @param  {Number}   anchor
         * @param  {Object}   start
         * @param  {Number}   focus
         * @param  {Object}   end
         * @return {Function}
         */
        var testFocus = function (text, anchor, start, focus, end) {
          return function () {
            // Set the value and trigger blur which will generate the markdown
            // element.
            view.setValue(text).trigger('blur');

            // Get the correct element positions to test.
            var markdownEl = view.el.getElementsByClassName('markdown')[0];
            var anchorPos  = getElPositions(markdownEl, anchor);
            var focusPos   = anchorPos;

            if (focus && anchor !== focus) {
              focusPos = getElPositions(markdownEl, focus);
            }

            var positions = view.getPositions({
              anchorNode:   anchorPos.node,
              anchorOffset: anchorPos.offset,
              focusNode:    focusPos.node,
              focusOffset:  focusPos.offset
            });

            expect(positions.start).to.deep.equal(start);
            expect(positions.end).to.deep.equal(end || start);
          };
        };

        it(
          'should focus normal text',
          testFocus('text', 2, { line: 0, ch: 2 })
        );

        it(
          'should focus text inside tags',
          testFocus('<strong>text</strong>', 2, { line: 0, ch: 10 })
        );

        it(
          'should focus text inside tags with attributes',
          testFocus(
            '<strong class="test">text</strong>', 2, { line: 0, ch: 23 }
          )
        );

        it(
          'should focus text in a list',
          testFocus('*  testing', 4, { line: 0, ch: 7 })
        );

        it(
          'should handle new lines',
          testFocus('* test\n* item', 5, { line: 1, ch: 3 })
        );

        it(
          'should focus text inside links',
          testFocus('[test](http://example.com)', 3, { line: 0, ch: 4 })
        );

        it(
          'should focus text after links',
          testFocus('[test](http://example.com) text', 6, { line: 0, ch: 28 })
        );

        it(
          'should focus text after images',
          testFocus('![test](http://example.com) text', 3, { line: 0, ch: 30 })
        );

        it(
          'should focus headers',
          testFocus('## Header', 5, { line: 0, ch: 8 })
        );

        it(
          'should focus text inside the trailing header syntax',
          testFocus('#### Header ####', 3, { line: 0, ch: 8 })
        );

        it(
          'should focus text after trailing header syntax',
          testFocus('### Header ###\ntext', 8, { line: 1, ch: 2 })
        );

        it(
          'should focus text after a horizontal break',
          testFocus('text\n\n---\n\ntesting', 7, { line: 4, ch: 3 })
        );

        it(
          'should focus text in a code block',
          testFocus('    code\n    goes\n    here', 11, { line: 2, ch: 5 })
        );

        it(
          'should focus text in a code fence',
          testFocus('```javascript\ncode\nhere\n```', 6, { line: 2, ch: 1 })
        );

        it(
          'should ignore comments',
          testFocus('<!-- testing -->\ntext here', 5, { line: 1, ch: 5 })
        );

        it(
          'should focus text after break tags',
          testFocus('test<br>text', 5, { line: 0, ch: 9 })
        );

        it(
          'shoud focus text in blockquotes',
          testFocus('> test quote', 5, { line: 0, ch: 7 })
        );

        it(
          'should focus text in underlined heading',
          testFocus('Header\n======', 3, { line: 0, ch: 3 })
        );

        it(
          'should focus text after underlined heading',
          testFocus('Header\n ==== \n\ntext here', 8, { line: 3, ch: 2 })
        );

        it(
          'should focus underline below heading',
          testFocus('## Header\n=======', 8, { line: 1, ch: 2 })
        );

        it(
          'should focus references',
          testFocus('[1]: http://example.com\n[link][1]', 2, { line: 1, ch: 3 })
        );

        it(
          'should focus autolinked emails',
          testFocus('<me@example.com>', 3, { line: 0, ch: 4 })
        );

        it(
          'should focus after autolinks',
          testFocus('<http://example.com> test', 21, { line: 0, ch: 23 })
        );

        it(
          'should focus after escaped characters',
          testFocus('\\(testing\\)', 4, { line: 0, ch: 5 })
        );

        it(
          'should focus strong text',
          testFocus('**testing**', 3, { line: 0, ch: 5 })
        );

        it(
          'should focus after strong text',
          testFocus('__testing__ text', 9, { line: 0, ch: 13 })
        );

        it(
          'should focus em text',
          testFocus('*testing*', 3, { line: 0, ch: 4 })
        );

        it(
          'should focus after em text',
          testFocus('_testing_ text', 9, { line: 0, ch: 11 })
        );

        it(
          'should focus em and strong text',
          testFocus('***testing***', 3, { line: 0, ch: 6 })
        );

        it(
          'should focus after em and strong text',
          testFocus('___testing___ text', 9, { line: 0, ch: 15 })
        );

        it(
          'should focus inline code',
          testFocus('`testing`', 3, { line: 0, ch: 4 })
        );

        it(
          'should focus after inline code',
          testFocus('`testing` text', 10, { line: 0, ch: 12 })
        );

        it(
          'should ignore trailing whitespace',
          testFocus('testing \ntext', 8, { line: 1, ch: 1 })
        );
      });
    });
  });
});
