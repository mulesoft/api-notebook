/* global describe, it */

describe('App', function () {
  var fixture = document.getElementById('fixture');

  describe('App instance', function () {
    var view;

    beforeEach(function () {
      view = new App.View.App();
    });

    afterEach(function () {
      view.remove();
    });

    it('should have a class name of `application`', function () {
      expect(view.el.className).to.contain('application');
    });

    describe('#render', function () {
      beforeEach(function () {
        view.render();
      });

      it('should render the template', function () {
        expect(view.el.children).to.have.length.above(1);
      });
    });

    describe('Generated App', function () {
      beforeEach(function () {
        view.render().appendTo(fixture);
      });

      it('should be able to set the notebook title', function () {
        var titleEl = view.el.querySelector('.notebook-title');
        titleEl.value = 'Test Notebook';

        simulateEvent(titleEl, 'keyup');
        simulateEvent(titleEl, 'blur');
        simulateEvent(titleEl, 'focusout');

        expect(
          App.persistence.get('notebook').get('meta').get('title')
        ).to.equal('Test Notebook');
      });
    });

    describe('Toggle Views', function () {
      var content = '```javascript\n\n```';
      var editor;

      beforeEach(function (done) {
        App.persistence.set('notebook', new App.Model.Notebook());
        App.persistence.get('notebook').set('content', content);
        view.render().appendTo(fixture);

        simulateEvent(view.el.querySelector('.toggle-notebook'), 'click');

        App.Library.DOMBars.VM.exec(function () {
          editor = view.el.querySelector('.CodeMirror').CodeMirror;
          return done();
        });
      });

      it('should switch to a raw notebook editor', function () {
        expect(editor.getValue()).to.equal(content);
      });

      it('should update persistence when editing the raw notebook', function () {
        editor.setValue('Simple test');

        expect(
          App.persistence.get('notebook').get('content')
        ).to.equal('Simple test');
      });
    });
  });
});
