var _          = require('underscore');
var Backbone   = require('backbone');
var router     = require('./router');
var messages   = require('./messages');
var middleware = require('./middleware');

/**
 * Persistence is a static model that holds all persistence based data. Only
 * two flags should ever be set - `userId` and `notebook` - but more could be
 * set external to the module.
 *
 * @type {Function}
 */
var Persistence = Backbone.Model.extend({
  defaults: {
    id:       null, // Holds the notebook unique id.
    userId:   null, // Holds the persistence session user id.
    ownerId:  null, // Holds the notebook owners user id.
    notebook: ''    // Holds the notebook content in serialized format.
  }
});

/**
 * Return whether the current user session is the owner of the current notebook.
 *
 * @return {Boolean}
 */
Persistence.prototype.isOwner = function () {
  return this.get('ownerId') === this.get('userId');
};

/**
 * Return whether a user is currently authenticated.
 *
 * @return {Boolean}
 */
Persistence.prototype.isAuthenticated = function () {
  return !!this.get('userId');
};

/**
 * Simple wrapper around the serialize method that also sets the notebook.
 *
 * @param {Array}    cells
 * @param {Function} done
 */
Persistence.prototype.update = function (cells, done) {
  this.serialize(cells, _.bind(function (err, notebook) {
    this.set('notebook', notebook);
    return done && done(err, notebook);
  }, this));
};

/**
 * Pass an array of cells that represent the notebook for serialization.
 *
 * @param {Array}    cells
 * @param {Function} done
 */
Persistence.prototype.serialize = function (cells, done) {
  middleware.trigger(
    'persistence:serialize',
    _.extend(this.getMiddlewareData(), {
      notebook: cells
    }),
    _.bind(function (err, data) {
      return done && done(err, data.notebook);
    }, this)
  );
};

/**
 * Trigger deserializing from the notebook contents.
 *
 * @param {Function} done
 */
Persistence.prototype.deserialize = function (done) {
  middleware.trigger(
    'persistence:deserialize',
    this.getMiddlewareData(),
    _.bind(function (err, data) {
      return done && done(err, data.notebook);
    }, this)
  );
};

/**
 * Save the notebook.
 *
 * @param {Function} done
 */
Persistence.prototype.save = function (done) {
  middleware.trigger(
    'persistence:save',
    this.getMiddlewareData(),
    _.bind(function (err, data) {
      this.set('id',       data.id);
      this.set('ownerId',  data.ownerId);

      return done && done(err, data.notebook);
    }, this)
  );
};

/**
 * Authenticate with the external persistence provider.
 *
 * @param {Function} done
 */
Persistence.prototype.authenticate = function (done) {
  middleware.trigger(
    'persistence:authenticate',
    this.getMiddlewareData(),
    _.bind(function (err, data) {
      this.set('userId', data.userId);
      return done && done(err, data.userId);
    }, this)
  );
};

/**
 * Get the persistence object in a format that is suitable for middleware.
 *
 * @return {Object}
 */
Persistence.prototype.getMiddlewareData = function () {
  return _.extend(this.toJSON(), {
    save:            _.bind(this.save, this),
    update:          _.bind(this.update, this),
    isOwner:         _.bind(this.isOwner, this),
    isAuthenticated: _.bind(this.isAuthenticated, this)
  });
};

/**
 * Load a notebook from an external service based on an id string.
 *
 * @param {String}   id
 * @param {Function} done
 */
Persistence.prototype.load = function (done) {
  return middleware.trigger(
    'persistence:load',
    _.extend(this.getMiddlewareData(), {
      ownerId:  null,
      notebook: null
    }),
    _.bind(function (err, data) {
      this.set('id',       data.id);
      this.set('userId',   data.userId);
      this.set('ownerId',  data.ownerId);
      this.set('notebook', data.notebook, { silent: true });
      // Triggers a custom reset notebook event to tell the notebook we can
      // cleanly rerender all notebook content.
      this.trigger('resetNotebook', this);
      return done && done(err, data.notebook);
    }, this)
  );
};

/**
 * Resets the persistence model state.
 */
Persistence.prototype.reset = function () {
  return this.set(this.defaults, { silent: true });
};

/**
 * Pseudo persistence forking.
 */
Persistence.prototype.fork = function () {
  // Allows a reference back to the original notebook. Could be a useful to
  // track where notebooks originally came from.
  if (this.get('id')) {
    this.set('originalId', this.get('id'));
  }
  // Removes the notebook id and sets the user id to the current user.
  this.set('id', null);
  this.set('ownerId', this.get('userId'));
};

/**
 * Exports a static instance of persistence.
 *
 * @type {Object}
 */
var persistence = module.exports = new Persistence();

/**
 * Listens to any changes to the user id and emits a custom `changeUser` event
 * that different parts of the application bind to and does things like
 * rerendering of notebook.
 */
persistence.listenTo(persistence, 'change:userId change:ownerId', function () {
  this.trigger('changeUser', this);
});

/**
 * Any time the notebook changes, trigger the `persistence:change` middleware
 * handler.
 */
persistence.listenTo(persistence, 'change:notebook', (function () {
  var changing    = false;
  var changeQueue = false;

  return function change () {
    // If we are already changing the data, but it has not yet been resolved,
    // set a change queue flag to `true` to let ourselves know we have changes
    // queued to sync once we finish the current operation.
    if (changing) { return changeQueue = true; }

    changing = true;
    middleware.trigger(
      'persistence:change',
      this.getMiddlewareData(),
      _.bind(function (err, data) {
        changing = false;
        if (changeQueue) {
          changeQueue = false;
          change.call(this);
        }
      }, this)
    );
  };
})());

/**
 * Check with an external service whether a users session is authenticated. This
 * will only check, and not actually trigger authentication which would be a
 * jarring experience. Also load the initial notebook contents alongside.
 */
persistence.listenTo(messages, 'ready', function () {
  persistence.load();

  return middleware.trigger(
    'persistence:authenticated',
    _.extend(this.getMiddlewareData(), {
      userId: null
    }), _.bind(function (err, data) {
      this.set('userId',  data.userId);
      this.set('ownerId', data.userId);
    }, this)
  );
});

/**
 * Redirects the page to the updated id.
 */
persistence.listenTo(persistence, 'change:id', function (model, id) {
  process.nextTick(function () {
    Backbone.history.navigate(_.isEmpty(id) ? '' : id.toString());
  });
});

/**
 * Loads the notebook from the persistence layer.
 *
 * @param  {String} id
 */
persistence.listenTo(
  router, 'route:newNotebook route:loadNotebook', function (id) {
    return persistence.set('id', id);
  }
);
