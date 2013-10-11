var _          = require('underscore');
var Backbone   = require('backbone');
var router     = require('./router');
var messages   = require('./messages');
var middleware = require('./middleware');

/**
 * Persistence is a static model that holds all persistent notebook data.
 *
 * @type {Function}
 */
var Persistence = Backbone.Model.extend({
  defaults: {
    id:         null,
    title:      'New Notebook',
    userId:     null,
    ownerId:    null,
    originalId: null,
    notebook:   []
  }
});

/**
 * Return whether the current user session is the owner of the current notebook.
 *
 * @return {Boolean}
 */
Persistence.prototype.isOwner = function () {
  if (!this.isReady || (!this.has('ownerId') && !this.has('userId'))) {
    return true;
  }

  return this.get('ownerId') === this.get('userId');
};

/**
 * Return whether a user is currently authenticated.
 *
 * @return {Boolean}
 */
Persistence.prototype.isAuthenticated = function () {
  return !this.isReady || this.has('userId');
};

/**
 * Pass an array of cells that represent the notebook for serialization.
 *
 * @param {Array}    cells
 * @param {Function} done
 */
Persistence.prototype.serialize = function (done) {
  middleware.trigger(
    'persistence:serialize',
    _.extend(this.getMiddlewareData(), {
      contents: null
    }),
    _.bind(function (err, data) {
      this.set('contents', data.contents);

      return done && done(err);
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
    _.extend(this.getMiddlewareData(), {
      title:    null,
      ownerId:  null,
      notebook: null
    }),
    _.bind(function (err, data) {
      this.set('title',    data.title || this.defaults.title);
      this.set('notebook', data.notebook);

      return done && done(err);
    }, this)
  );
};

/**
 * Save the notebook.
 *
 * @param {Function} done
 */
Persistence.prototype.save = function (done) {
  if (!this.isOwner()) {
    return done(new Error('Not the current owner.'));
  }

  middleware.trigger(
    'persistence:save',
    this.getMiddlewareData(),
    _.bind(function (err, data) {
      this.set('id',      data.id);
      this.set('ownerId', data.ownerId);

      return done && done(err);
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

      // When we authenticate, the owner id will be out of sync here. If we
      // don't currently have an `id` and `ownerId`, we'll set the user to be
      // the notebook owner.
      if (!this.get('id') && !this.get('ownerId')) {
        this.set('ownerId', data.userId);
      }

      return done && done(err);
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
      contents: null,
      notebook: null
    }),
    _.bind(function (err, data) {
      this._loading = true;

      this.set('id',       data.id);
      this.set('ownerId',  data.ownerId);
      this.set('contents', data.contents, { silent: true });
      this.set('notebook', data.notebook, { silent: true });

      var complete = _.bind(function () {
        this._loading = false;
        this.trigger('changeNotebook', this);
        return done && done(err);
      }, this);

      // No post-processing required.
      if (this.has('contents') && this.has('notebook')) {
        return complete();
      }

      // Requires serializing to text.
      if (this.has('notebook')) {
        return this.serialize(complete);
      }

      // Requires deserializing to the notebook array.
      return this.deserialize(complete);
    }, this)
  );
};

/**
 * Resets the persistence model state.
 */
Persistence.prototype.reset = function () {
  return this.set(_.extend(this.defaults, {
    notebook: []
  }), { silent: true });
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
 * Export a static instance of the persistence model.
 *
 * @type {Object}
 */
var persistence = module.exports = window.persistence = new Persistence();

/**
 * Simple function used as a safeguard to block any accidental recursion with
 * syncing data between persistence fields.
 *
 * @param  {Function} fn
 * @return {Function}
 */
var syncProtection = function (fn) {
  return function () {
    // Break execution when we are already syncing.
    if (persistence._syncing) { return; }

    persistence._syncing = true;
    fn.apply(this, arguments);
  };
};

/**
 * Keeps the serialized notebook in sync with the deserialized version.
 */
persistence.listenTo(
  persistence, 'change:notebook change:title', syncProtection(function () {
    // Serialize the notebook contents and remove sync protection.
    persistence.serialize(function () {
      persistence._syncing = false;
    });
  })
);

/**
 * Keeps the deserialized notebook contents in sync with the serialized content.
 */
persistence.listenTo(
  persistence, 'change:contents', syncProtection(function () {
    // Deserialize the contents and remove sync protection.
    persistence.deserialize(function () {
      persistence._syncing = false;
    });
  })
);

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
persistence.listenTo(persistence, 'change:contents', (function () {
  var changing    = false;
  var changeQueue = false;

  return function change () {
    // Block updates when loading a notebook.
    if (this._loading) { return; }

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

      if (!this.get('id') && !this.get('ownerId')) {
        this.set('ownerId', data.userId);
      }

      // Set an `isReady` flag on the persistence model. This is used to check
      // if the user is authenticated and if the user is the owner.
      this.isReady = true;
    }, this)
  );
});

/**
 * Redirects the page to the updated id.
 */
persistence.listenTo(persistence, 'change:id', function (model, id) {
  process.nextTick(function () {
    Backbone.history.navigate(id == null ? '' : id.toString());
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
