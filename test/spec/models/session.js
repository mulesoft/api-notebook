/* global describe, it */

describe('Session Model', function () {
  var Model = App.Model.Session;

  it('should exist', function () {
    expect(Model).to.be.a('function');
  });

  describe('session instance', function () {
    var model;

    beforeEach(function () {
      model = new Model();
    });

    describe('server communication', function () {
      var server;

      beforeEach(function () {
        server = sinon.fakeServer.create();
      });

      afterEach(function () {
        server.restore();
      });

      describe('sync', function () {
        it.skip('should attempt to sync with /session', function (done) {
          var spy = sinon.spy(function (model, xhr) {
            expect(xhr.status).to.equal(401);
            done();
          });
          // Unauthorized
          server.respondWith('GET', '/session', [401, null, '']);

          model.fetch({ error: spy });

          server.respond();
        });

        it.skip('should sync with /session successfully', function (done) {
          var spy = sinon.spy(function (model, data) {
            expect(data.id).to.equal(123);
            expect(model.get('id')).to.equal(123);
            done();
          });
          // Unauthorized
          server.respondWith('GET', '/session', [200, null, '{"id":123}']);

          model.fetch({
            success: spy
          });

          server.respond();
        });
      });
    });

    describe('user changes', function () {
      it('should trigger an event when the user id changes', function () {
        var spy = sinon.spy();

        model.on('changeUser', spy);

        model.set('id', 123);
        expect(spy).to.have.been.calledOnce;

        model.set('id', 123);
        expect(spy).to.have.been.calledOnce;
      });
    });
  });
});
