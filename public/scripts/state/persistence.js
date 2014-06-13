var _                = require('underscore');
var Backbone         = require('backbone');
var config           = require('./config');
var messages         = require('./messages');
var middleware       = require('./middleware');
var bounce           = require('../lib/bounce');
var isMac            = require('../lib/browser/about').mac;
var Notebook         = require('../models/notebook');
var PersistenceItems = require('../collections/persistence-items');

/**
 * Persistence is a static model that holds all persistent notebook data.
 *
 * @type {Function}
 */
var Persistence = Backbone.Model.extend({
  defaults: {
    items:      new PersistenceItems(),
    notebook:   new Notebook(),
    state:      0,
    userId:     null,
    userTitle:  '',
    readyState: false
  }
});

/**
 * Represent persistence states in event listeners as numerical entities.
 *
 * @type {Number}
 */
Persistence.prototype.NULL      = Persistence.NULL      = 0;
Persistence.prototype.SAVING    = Persistence.SAVING    = 1;
Persistence.prototype.LOADING   = Persistence.LOADING   = 2;
Persistence.prototype.SAVE_FAIL = Persistence.SAVE_FAIL = 3;
Persistence.prototype.SAVE_DONE = Persistence.SAVE_DONE = 4;
Persistence.prototype.LOAD_FAIL = Persistence.LOAD_FAIL = 5;
Persistence.prototype.LOAD_DONE = Persistence.LOAD_DONE = 6;
Persistence.prototype.CHANGED   = Persistence.CHANGED   = 7;
Persistence.prototype.CLONING   = Persistence.CLONING   = 8;

/**
 * Return whether the current user session is the owner of the current notebook.
 *
 * @param  {Object}  model
 * @return {Boolean}
 */
Persistence.prototype.isOwner = function (model) {
  return !model.get('ownerId') || model.get('ownerId') === this.get('userId');
};

/**
 * Check if the user is the owner of the current notebook.
 *
 * @return {Boolean}
 */
Persistence.prototype.isCurrentOwner = function () {
  return this.isOwner(this.get('notebook'));
};

/**
 * Check if a model is new.
 *
 * @param  {Object}  model
 * @return {Boolean}
 */
Persistence.prototype.isNew = function (model) {
  return !model.get('id');
};

/**
 * Check if the current model is new.
 *
 * @return {Boolean}
 */
Persistence.prototype.isCurrentNew = function () {
  return this.isNew(this.get('notebook'));
};

/**
 * Return whether a user is currently authenticated.
 *
 * @return {Boolean}
 */
Persistence.prototype.isAuthenticated = function () {
  return this.has('userId');
};

/**
 * Checks whether a persistence model has been unsaved.
 *
 * @param  {Object}  model
 * @return {Boolean}
 */
Persistence.prototype.isSaved = function (model) {
  // Check against a map of the different states.
  return model.get('savedContent') === model.get('content');
};

/**
 * Check if the current model has been saved.
 *
 * @return {Boolean}
 */
Persistence.prototype.isCurrentSaved = function () {
  return this.isSaved(this.get('notebook'));
};

/**
 * Check whether a notebook should be saved. There are a number of factors that
 * dictate whether we *should* save the notebook.
 *
 * @param  {Object}  model
 * @return {Boolean}
 */
Persistence.prototype.shouldSave = function (model) {
  return !this.isNew(model) &&
    !this.isSaved(model) &&
    this.isOwner(model) &&
    this.isAuthenticated();
};

/**
 * Serialize a model and update the content string.
 *
 * @param {Object}   model
 * @param {Function} done
 */
Persistence.prototype.serialize = function (model, done) {
  middleware.trigger(
    'persistence:serialize',
    _.extend(this.getMiddlewareData(model), {
      content: null
    }),
    function (err, data) {
      model.set('content', data.content);
      return done(err, data);
    }
  );
};

/**
 * Deserialize a models content and set the cells array.
 *
 * @param {Object}   object
 * @param {Function} done
 */
Persistence.prototype.deserialize = function (model, done) {
  middleware.trigger(
    'persistence:deserialize',
    _.extend(this.getMiddlewareData(model), {
      ownerId: null,
      cells:   null
    }),
    function (err, data) {
      model.get('meta').reset(data.meta);
      model.set('cells', data.cells);
      return done(err, data);
    }
  );
};

/**
 * Create a new notebook.
 *
 * @param {Function} done
 */
Persistence.prototype.new = function (done) {
  this.set('state', Persistence.NULL);

  return this.load(new Notebook(), done);
};

/**
 * Save a notebook model.
 *
 * @param {Object}   model
 * @param {Function} done
 */
Persistence.prototype.save = function (model, done) {
  if (!config.get('savable')) {
    return done && done(new Error('Save is not available'));
  }

  if (!this.isOwner(model)) {
    return done && done(new Error('You are not the current notebook owner'));
  }

  this.set('state', Persistence.SAVING);

  middleware.trigger(
    'persistence:save',
    this.getMiddlewareData(model),
    _.bind(function (err, data) {
      if (err) {
        this.set('state', Persistence.SAVE_FAIL);
        return done && done(err);
      }

      // Update the model attributes.
      model.set('id',        data.id);
      model.set('content',   data.content);
      model.set('ownerId',   data.ownerId);
      model.set('updatedAt', new Date());
      model.get('meta').reset(data.meta);
      model.set('savedContent', model.get('content'));

      this.set('state', Persistence.SAVE_DONE);

      // Add a persistence item entry.
      this.get('items').add({
        id:        model.get('id'),
        meta:      model.get('meta').toJSON(),
        updatedAt: model.get('updatedAt')
      }, {
        merge: true
      });

      return done && done();
    }, this)
  );
};

/**
 * Remove a given notebook, specified by its id, which is persistence
 * engine-specific.
 *
 * @param {String}   id
 * @param {Function} done
 */
Persistence.prototype.remove = function (id, done) {
  middleware.trigger('persistence:remove', {
    id: id
  }, _.bind(function(err) {
    if (err) {
      return done && done(err);
    }

    this.get('items').remove(this.get('items').get(id));

    return done && done();
  }, this));
};

/**
 * Authenticate with the external persistence provider.
 *
 * @param {Function} done
 */
Persistence.prototype.authenticate = function (done) {
  if (!config.get('authentication')) {
    return done && done(new Error('Authentication has been disabled'));
  }

  middleware.trigger(
    'persistence:authenticate',
    _.extend(this.getMiddlewareData(), {
      userId:    null,
      userTitle: null
    }),
    _.bind(function (err, data) {
      this.set('userId',    data.userId);
      this.set('userTitle', data.userTitle);

      return done && done(err);
    }, this)
  );
};

/**
 * Unauthenticate the persistence layer login.
 *
 * @param {Function} done
 */
Persistence.prototype.unauthenticate = function (done) {
  middleware.trigger(
    'persistence:unauthenticate',
    this.getMiddlewareData(),
    _.bind(function (err) {
      this.unset('userId');
      this.unset('userTitle');

      this.get('items').reset();

      return done && done(err);
    }, this)
  );
};

/**
 * Get the persistence object in a format that is suitable for middleware.
 *
 * @return {Object}
 */
Persistence.prototype.getMiddlewareData = function (model) {
  var obj = model ? model.toJSON() : {};

  return _.extend(obj, {
    meta:            model ? model.get('meta').toJSON() : {},
    save:            _.bind(this.save, this, model),
    isNew:           _.bind(this.isNew, this, model),
    isOwner:         _.bind(this.isOwner, this, model),
    isSaved:         _.bind(this.isSaved, this, model),
    shouldSave:      _.bind(this.shouldSave, this, model),
    authenticate:    _.bind(this.authenticate, this),
    isAuthenticated: _.bind(this.isAuthenticated, this)
  });
};

/**
 * Load a notebook model.
 *
 * @param {Object}   model
 * @param {Function} done
 */
Persistence.prototype.load = function (model, done) {
  model._loading = true;
  this.set('state', Persistence.LOADING);

  return middleware.trigger(
    'persistence:load',
    _.extend(this.getMiddlewareData(model), {
      meta:    {},
      content: null,
      cells:   null
    }),
    _.bind(function (err, data) {
      // Update all relevant model attributes.
      model.set({
        id:        data.id,
        ownerId:   data.ownerId,
        updatedAt: data.updatedAt
      });

      model.set('content', data.content, {
        silent: true
      });

      delete model._loading;

      var complete = _.bind(function (err) {
        this.set('state', err ? Persistence.LOAD_FAIL : Persistence.LOAD_DONE);

        return done && done(err);
      }, this);

      if (err) {
        return complete(err);
      }

      return this.loadModel(model, complete);
    }, this)
  );
};

/**
 * Extremely basic model load function.
 */
Persistence.prototype.loadModel = function (model, done) {
  return this.deserialize(model, _.bind(function (err) {
    model.set('savedContent', model.get('content'));

    this.set('notebook', model);
    config.set('content', model.get('content'));
    this.trigger('changeNotebook');

    return done && done(err);
  }, this));
};

/**
 * Generate a list of all loadable notebooks. Note that this will often
 * involve going to the network or disk.
 *
 * @param {Function} done
 */
Persistence.prototype.list = function (done) {
  if (!this.isAuthenticated()) {
    return done && done(new Error('Not authenticated'));
  }

  return middleware.trigger(
    'persistence:list', [], _.bind(function (err, list) {
      this.get('items').set(list);

      return done(err, this.get('items').toJSON());
    }, this)
  );
};

/**
 * Clone the notebook and reset the persistence layer to look normal again.
 */
Persistence.prototype.clone = function (done) {
  this.set('state', Persistence.CLONING);

  var model = this.get('notebook').clone();

  // Set the notebook instance in the state.
  model.unset('id');
  model.unset('ownerId');

  middleware.trigger(
    'persistence:clone',
    this.getMiddlewareData(model),
    _.bind(function (err, data) {
      model.set('cells', data.cells, { silent: true });
      model.get('meta').reset(data.meta);

      this.set('state', Persistence.NULL);
      this.set('notebook', model);
      this.trigger('changeNotebook');

      return done && done(err);
    }, this)
  );
};

/**
 * Export a static instance of the persistence model.
 *
 * @type {Object}
 */
var persistence = module.exports = new Persistence();

/**
 * Sync the notebook and stringified contents together.
 */
persistence.listenTo(persistence, 'change:notebook', bounce((function () {
  var model   = persistence.get('notebook');
  var syncing = false;

  /**
   * Wrap sync methods to protect from an infinite loop.
   *
   * @param  {Function} fn
   * @return {Function}
   */
  var wrapSync = function (method) {
    return function () {
      if (syncing) { return; }

      syncing = true;

      return persistence[method](model, function () {
        syncing = false;
      });
    };
  };

  /**
   * Wrap serialization in async guards.
   */
  var serialize   = wrapSync('serialize');
  var deserialize = wrapSync('deserialize');

  return function () {
    /**
     * Remove listeners on the previous notebook instance.
     */
    persistence.stopListening(model);
    persistence.stopListening(model.get('meta'));
    model = persistence.get('notebook');

    /**
     * Deserialize the notebook on static changes.
     */
    persistence.listenTo(model, 'change:content', deserialize);

    /**
     * Serialize the notebook on dynamic changes.
     */
    persistence.listenTo(model, 'change:cells', serialize);
    persistence.listenTo(model.get('meta'), 'change', serialize);

    /**
     * Update the configuration id any time the model changes.
     */
    persistence.listenTo(model, 'change:id', bounce(function () {
      config.set('id', model.get('id'));
    }));

    /**
     * Any changes that occur should be synced with the state and config.
     */
    persistence.listenTo(model, 'change:content', bounce(function () {
      // Avoid triggering content changes when the notebook is loading.
      if (model._loading) { return; }

      var hasChanged = !persistence.isSaved(model);

      config.set('content', model.get('content'));
      persistence.set('state', persistence[hasChanged ? 'CHANGED' : 'NULL']);

      middleware.trigger(
        'persistence:change',
        persistence.getMiddlewareData(persistence.get('notebook'))
      );
    }));
  };
})()));

/**
 * Listens to any changes to the user id and emits a custom `changeUser` event
 * that different parts of the application bind to and does things like
 * rerendering of notebook.
 */
persistence.listenTo(
  persistence, 'change:userId change:userTitle', _.debounce(function () {
    this.trigger('changeUser', this);
  }, 300)
);

/**
 * Check with an external service whether a users session is authenticated. This
 * should only check, and not actually trigger authentication which would be a
 * jarring experience. Also load the initial notebook contents alongside.
 */
persistence.listenTo(middleware, 'application:ready', function () {
  if (!config.get('authentication')) {
    return;
  }

  return middleware.trigger(
    'persistence:authenticated',
    _.extend(this.getMiddlewareData(), {
      userId:    null,
      userTitle: null
    }), _.bind(function (err, data) {
      this.set('userId',     data.userId);
      this.set('userTitle',  data.userTitle);

      // Set the ready state flag for the API Notebook Site to hook onto.
      this.set('readyState', true);

      if (!this.has('id') && !this.has('ownerId')) {
        this.set('ownerId', this.get('userId'));
      }
    }, this)
  );
});

/**
 * On load messages, reload the current persistence object.
 */
persistence.listenTo(messages, 'load', function (id) {
  return persistence.load(new Notebook({ id: id }));
});

/**
 * Keep the persistence meta data in sync with the config option.
 */
persistence.listenTo(config, 'change:url', function () {
  if (!config.get('id')) { return; }

  persistence.get('notebook').get('meta').set('site', config.get('url'));
});

/**
 * When the application is ready, finally attempt to load the initial content.
 *
 * @param {Object}   app
 * @param {Function} next
 */
middleware.register('application:ready', function (app, next) {
  var notebook = new Notebook({
    id:      config.get('id'),
    content: config.get('content')
  });

  // Handle configuration content over a remote data load.
  if (notebook.get('content')) {
    return persistence.loadModel(notebook, next);
  }

  return persistence.load(notebook, next);
});

/**
 * When the application is ready, start listening for live id changes.
 *
 * @param {Object}   app
 * @param {Function} next
 */
middleware.register('application:ready', function (app, next) {
  /**
   * Listens for global id changes and updates persistence. Primarily for
   * loading a new notebook from the embed frame where the current url scheme
   * is unlikely to be maintained.
   */
  persistence.listenTo(config, 'change:id', function () {
    var configId   = config.get('id');
    var notebookId = persistence.get('notebook').get('id');

    // Avoid loading over the same notebook instance.
    if ((!configId && !notebookId) || (configId === notebookId)) {
      return;
    }

    persistence.load(new Notebook({ id: configId }));
  });

  return next();
});

/**
 * When the application is ready, start listening for config content changes.
 *
 * @param {Object}   app
 * @param {Function} next
 */
middleware.register('application:ready', function (app, next) {
  persistence.listenTo(config, 'change:content', function () {
    var configContent   = config.get('content');
    var notebookContent = persistence.get('notebook').get('content');

    // Avoid loading over the same notebook content.
    if (configContent === notebookContent) {
      return;
    }

    persistence.loadModel(new Notebook({ content: configContent }));
  });

  return next();
});

/**
 * Register a function to block the regular save button and override with saving
 * to the persistence layer.
 */
middleware.register(
  'keydown:' + (isMac ? 'Cmd' : 'Ctrl') + '-S',
  function (event, next, done) {
    if (!config.get('savable')) { return; }

    event.preventDefault();
    return persistence.save(persistence.get('notebook'), done);
  }
);
