/* global describe, it */

describe('Embeddable Widget', function () {
  var fixture = document.getElementById('fixture');

  this.timeout(5000);

  it('should exist', function () {
    expect(Notebook).to.exist;
  });

  it('should append to a DOM node', function () {
    expect(fixture.childNodes.length).to.equal(0);

    var notebook = new Notebook(fixture);

    expect(fixture.childNodes.length).to.equal(1);
    expect(fixture.childNodes[0]).to.equal(notebook.el);

    notebook.remove();
  });

  it('should accept a custom append function', function () {
    expect(fixture.childNodes.length).to.equal(0);

    var notebook = new Notebook(function (el) {
      fixture.appendChild(el);
    });

    expect(fixture.childNodes.length).to.equal(1);
    expect(fixture.childNodes[0]).to.equal(notebook.el);

    notebook.remove();
  });

  it('should be able to initialize with custom styles', function () {
    var notebook = new Notebook(fixture, {}, {
      border: '1px solid red'
    });

    expect(fixture.childNodes.length).to.equal(1);
    expect(fixture.childNodes[0]).to.equal(notebook.el);
    expect(notebook.el.style.borderWidth).to.equal('1px');
    expect(notebook.el.style.borderStyle).to.equal('solid');
    expect(notebook.el.style.borderColor).to.equal('red');

    notebook.remove();
  });

  it('should trigger a ready event when the child frame is ready', function (done) {
    var notebook = new Notebook(fixture);

    notebook.on('ready', function () {
      notebook.remove();
      return done();
    });
  });

  it('should be able to pass objects into the notebook context', function (done) {
    var alias = {
      test: 'success',
      again: 'more'
    };

    var notebook = new Notebook(fixture, {
      alias: alias
    });

    notebook.on('ready', function () {
      notebook.getVariable('test', function (variable) {
        expect(variable).to.equal(alias.test);

        notebook.getVariable('again', function (variable) {
          expect(variable).to.equal(alias.again);
          notebook.remove();
          return done();
        });
      });
    });
  });

  it('should be able to inject scripts before the app initializes', function (done) {
    var notebook = new Notebook(fixture, {
      inject: [FIXTURES_URL + '/test.js']
    });

    notebook.on('rendered', function () {
      notebook.getVariable('test', function (flag) {
        expect(flag).to.be.true;
        notebook.remove();
        return done();
      });
    });
  });

  it('should be able to register ready functions that trigger when ready', function (done) {
    var spy      = sinon.spy();
    var notebook = new Notebook(fixture);

    notebook.ready(spy);

    notebook.on('ready', function () {
      expect(spy).to.have.been.calledOnce;

      notebook.ready(spy);
      expect(spy).to.have.been.calledTwice;

      notebook.remove();
      return done();
    });
  });
});
