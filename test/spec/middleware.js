/* global describe, it, afterEach, expect, sinon, App */

describe('Middleware', function () {
  var middleware = App.middleware;

  it('should exist', function () {
    expect(middleware).to.exist;
  });

  describe('events', function () {
    it('should trigger a regular event', function () {
      var spy = sinon.spy();
      middleware.on('test', spy);
      middleware.trigger('test');
      expect(spy).to.have.been.called;
    });
  });

  describe('plugins', function () {
    var origCore  = middleware._core;
    var origStack = middleware._stack;

    beforeEach(function () {
      middleware._stack = {};
    });

    after(function () {
      middleware._stack = origStack;
    });

    it('should define a `use` method', function () {
      expect(middleware.register).to.be.a('function');
    });

    it('should add middleware functions to be called on an event', function () {
      var spy = sinon.spy();

      middleware.register('test', spy);
      middleware.trigger('test');

      expect(spy).to.have.been.calledOnce;
    });

    it('should expose a check to see if middleware is being handled', function () {
      expect(middleware.exists('test')).to.be.false;

      middleware.register('test', sinon.stub());

      expect(middleware.exists('test')).to.be.true;
    });

    it('should trigger an add event when a plugin is added', function () {
      var spy = sinon.spy();

      middleware.on('middleware:register', spy);

      expect(spy).to.not.have.been.called;
      middleware.register('test', sinon.stub());
      expect(spy).to.have.been.called;
    });

    it('should trigger a remove event when a plugin is removed', function () {
      var spy  = sinon.spy();
      var stub = sinon.stub();

      middleware.register('test', stub);
      middleware.on('middleware:deregister', spy);

      expect(spy).to.not.have.been.called;
      middleware.deregister('test', stub);
      expect(spy).to.have.been.called;
    });

    it('should loop through middleware', function () {
      var spy = sinon.spy(function (data, next) {
        next();
      });

      middleware.register('test', spy);
      middleware.register('test', spy);
      middleware.trigger('test');

      expect(spy).to.have.been.calledTwice;
    });

    it('should not loop through if we don\'t call next', function () {
      var spy = sinon.spy();

      middleware.register('test', spy);
      middleware.register('test', spy);
      middleware.trigger('test');

      expect(spy).to.have.been.calledOnce;
    });

    it('should be able to pass through a custom data object', function () {
      var spy = sinon.spy(function (data) {
        expect(data.test).to.equal('success');
      });

      middleware.register('test', spy);
      middleware.trigger('test', { test: 'success' });

      expect(spy).to.have.been.calledOnce;
    });

    it('should be able to pass a function to run when complete', function () {
      var spy = sinon.spy();

      middleware.trigger('test', null, spy);

      expect(spy).to.have.been.calledOnce;
    });

    it('should be able to run complete function after multiple middleware', function () {
      var spy  = sinon.spy();
      var next = sinon.spy(function (data, next) {
        next();
      });

      middleware.register('test', next);
      middleware.register('test', next);
      middleware.register('test', next);
      middleware.trigger('test', null, spy);

      expect(spy).to.have.been.calledOnce;
      expect(next).to.have.been.calledThrice;
    });

    it('should be able to short circuit the rest of the execution stack', function () {
      var spy  = sinon.spy();
      var next = sinon.spy(function (data, next, done) {
        done();
      });

      middleware.register('test', next);
      middleware.register('test', next);
      middleware.register('test', next);
      middleware.trigger('test', null, spy);

      expect(spy).to.have.been.calledOnce;
      expect(next).to.have.been.calledOnce;
    });

    it('should only be able to call next once', function () {
      var spy1 = sinon.spy();
      var spy2 = sinon.spy();

      middleware.register('test', spy2);
      middleware.register('test', spy1);
      middleware.register('test', function (data, next) {
        next();
        next();
        next();
      });

      middleware.trigger('test');

      expect(spy1).to.have.been.calledOnce;
      expect(spy2).to.not.have.been.called;
    });

    it('should only be able to call done once', function () {
      var spy = sinon.spy();

      middleware.register('test', function (data, next, done) {
        done();
        done();
        done();
      });
      middleware.trigger('test', null, spy);

      expect(spy).to.have.been.calledOnce;
    });

    it('should not be able to call done after calling next', function () {
      var nextSpy = sinon.spy();
      var doneSpy = sinon.spy();

      middleware.register('test', nextSpy);
      middleware.register('test', function (data, next, done) {
        next();
        done();
      });
      middleware.trigger('test', null, doneSpy);

      expect(nextSpy).to.have.been.calledOnce;
      expect(doneSpy).to.not.have.been.called;
    });

    it('should not be able to call next after calling done', function () {
      var nextSpy = sinon.spy();
      var doneSpy = sinon.spy();

      middleware.register('test', nextSpy);
      middleware.register('test', function (data, next, done) {
        done();
        next();
      });
      middleware.trigger('test', null, doneSpy);

      expect(doneSpy).to.have.been.calledOnce;
      expect(nextSpy).to.not.have.been.called;
    });

    it('should be able to remove a middleware plugin', function () {
      var spy = sinon.spy();

      middleware.register('test', spy);
      middleware.deregister('test', spy);

      middleware.trigger('test');

      expect(spy).to.not.have.been.called;
    });

    it('should be able to alter the data passed to the next function', function () {
      var firstSpy = sinon.spy(function (data, next) {
        next(null, 'Test');
      });
      var secondSpy = sinon.spy(function (data, next) {
        expect(data).to.equal('Test');
        next();
      });

      middleware.register('test', secondSpy);
      middleware.register('test', firstSpy);
      middleware.trigger('test', 'Something Else');

      expect(firstSpy).to.have.been.calledOnce;
      expect(secondSpy).to.have.been.calledOnce;
    });

    it('should be able to alter the data passed to the done function', function (done) {
      var spy = sinon.spy(function (data, next, done) {
        done(null, 'Test');
      });

      middleware.register('test', spy);
      middleware.trigger('test', null, function (err, data) {
        expect(err).to.not.exist;
        expect(spy).to.have.been.calledOnce;
        expect(data).to.equal('Test');
        done();
      });
    });

    it('should be able to register error handling middleware', function () {
      var errorSpy = sinon.spy(function (err, data, next, done) {
        expect(err.message).to.equal('Test');
        next();
      });

      var throwSpy = sinon.spy(function (data, next) {
        throw new Error('Test');
      });

      middleware.register('test', errorSpy);
      middleware.register('test', throwSpy);

      middleware.trigger('test', null, function (err) {
        expect(err).to.not.exist;
      });

      expect(throwSpy).to.have.been.calledOnce;
      expect(errorSpy).to.have.been.calledOnce;
    });

    it('should be able to resolve middleware asynchronously', function (done) {
      var spy = sinon.spy(function (data, next) {
        setTimeout(function () {
          next();
        }, 0);
      });

      middleware.register('test', spy);
      middleware.register('test', spy);
      middleware.register('test', spy);

      middleware.trigger('test', null, function () {
        expect(spy).to.have.been.calledThrice;
        done();
      });
    });

    it('should be able to pass errors asynchronously', function (done) {
      var errorSpy = sinon.spy(function (err, data, next, done) {
        expect(err.message).to.equal('Test');
        next();
      });
      var throwSpy = sinon.spy(function (data, next) {
        setTimeout(function () {
          next(new Error('Test'));
        }, 0);
      });

      middleware.register('test', errorSpy);
      middleware.register('test', throwSpy);
      middleware.register('test', errorSpy);
      middleware.register('test', errorSpy);

      middleware.trigger('test', null, function (err) {
        expect(err).to.not.exist;
        expect(errorSpy).to.have.been.calledOnce;
        expect(throwSpy).to.have.been.calledOnce;
        done();
      });
    });

    it('should be able to pass errors to the next error handling middleware', function () {
      var errorSpy = sinon.spy(function (err, data, next, done) {
        expect(error.message).to.equal('Test');
        next(err);
      });

      middleware.register('test', errorSpy);
      middleware.register('test', errorSpy);
      middleware.register('test', errorSpy);
      middleware.register('test', function () { throw new Error('Test'); });

      middleware.trigger('test');

      expect(errorSpy).to.have.been.calledThrice;
    });

    it('should accept an object of { name => function } pairs to use', function () {
      var spy = sinon.spy();

      middleware.register({
        test: spy
      });

      middleware.trigger('test');

      expect(spy).to.have.been.calledOnce;
    });

    it('should accept an object of { name => function } pairs to disuse', function () {
      var spy = sinon.spy();

      middleware.register('test', spy);
      middleware.deregister({
        test: spy
      });

      middleware.trigger('test');

      expect(spy).to.not.have.been.called;
    });
  });
});
