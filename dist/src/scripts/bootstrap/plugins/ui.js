var _          = require('underscore');
var domify     = require('domify');
var Backbone   = require('backbone');
var middleware = require('../../state/middleware');

/**
 * Generate the HTML for a modal popup.
 *
 * @type {Function}
 */
var template = _.template([
  '<div class="modal" tabindex="-1">',
  '<div class="modal-dialog">',
  '<div class="modal-content">',
  '<% if (title) { %>',
  '<div class="modal-header">',
  '<button class="modal-close" data-dismiss>&times;</button>',
  '<h4 class="modal-title"><%- title %></h4>',
  '</div>',
  '<% } %>',
  '<div class="modal-body">',
  '<%= content %>',
  '</div>',
  '</div>',
  '</div>',
  '</div>'
].join('\n'));

/**
 * Simple middleware handler for opening modal windows. It should proceed to
 * the next function in the execution stack when the modal window is closed.
 *
 * @param {Object}   options
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('ui:modal', function (options, next, done) {
  // Allow asynchronous template loads based on content type and number of
  // function arguments.
  var async = false;
  var templateOptions = {
    title:   options.title,
    content: options.content
  };

  // Check if content is a function. If it is, just execute it or put the modal
  // into async mode.
  if (_.isFunction(options.content)) {
    if (!options.content.length) {
      templateOptions.content = options.content();
    } else {
      async = true;
      templateOptions.content = [
        '<div class="text-center">',
        '<i class="icon-arrows-cw animate-spin"></i>',
        '</div>'
      ].join('\n');
    }
  }

  // Render the modal with a close function.
  var modal = {
    el: domify(template(templateOptions)),
    close: function (err) {
      modal.closed = true;
      middleware.deregister('keydown:Esc', escMiddleware);
      document.body.removeChild(modal.el);
      document.body.classList.remove('modal-visible');
      return done(err);
    },
    closed: false
  };

  // Hook into the esc key and remove the modal.
  var escMiddleware = function (event, next, done) {
    modal.close();
    return done();
  };

  // Trigger the async function callback and render the modal body.
  if (async) {
    options.content(function (err, content) {
      if (err) {
        modal.close();
        return done(err);
      }

      modal.el.querySelector('.modal-body').innerHTML = content;
    });
  }

  document.body.appendChild(modal.el);
  document.body.classList.add('modal-visible');

  // Focus the current modal to make tabbing easier.
  modal.el.focus();

  middleware.register('keydown:Esc', escMiddleware);
  Backbone.$(modal.el)
    .on('click', function (e) {
      if (e.target !== modal.el) { return; }

      return modal.close();
    })
    .on('click', '[data-dismiss]', _.bind(modal.close, null, null));

  // Execute the after render function which can be used to attach more
  // functionality to the modal.
  return _.isFunction(options.show) && options.show(modal);
});

/**
 * Extends the modal middleware for providing a confirmation dialog window.
 *
 * @param {Object}   data
 * @param {Function} next
 * @param {Function} done
 */
middleware.register('ui:confirm', function (data, next, done) {
  var confirmed = false;

  return middleware.trigger('ui:modal', {
    title: data.title,
    content: data.content,
    show: function (modal) {
      Backbone.$(modal.el).on('click', '[data-confirm]', function () {
        confirmed = true;
        return modal.close();
      });

      modal.el.querySelector('.modal-body').appendChild(domify(
        '<div class="btn-list text-center">' +
        '<button class="btn btn-secondary" data-dismiss>Cancel</button>' +
        '<button class="btn btn-primary" data-confirm>OK</button>' +
        '</div>'
      ));

      modal.el.querySelector('[data-confirm]').focus();
    }
  }, function (err) {
    return done(err, confirmed);
  });
});

/**
 * Notify the user of something.
 *
 * @param {Object}   data
 * @param {Function} next
 */
middleware.register('ui:notify', function (data, next) {
  var title = '';

  if (data.title) {
    title = [
      '<p class="modal-headline">',
      '<strong>' + _.escape(data.title) + '</strong>',
      '</p>'
    ].join('\n');
  }

  return middleware.trigger('ui:modal', {
    content: [
      title + '<p>' + _.escape(data.message) + '</p>',
      '<div class="text-center">',
      '<button class="btn btn-primary" data-dismiss>OK</button>',
      '</div>'
    ].join('\n'),
    show: function (modal) {
      modal.el.className += ' modal-notify';
      modal.el.querySelector('.btn').focus();
    }
  }, next);
});
