var _          = require('underscore');
var Backbone   = require('backbone');
var middleware = require('../../../../state/middleware');

/**
 * Keep track of open popup windows so we only have one open at a time.
 *
 * @type {Object}
 */
var openPopup, openModal, closeInterval;

/**
 * Closes previously opened windows and modals.
 */
var closeAll = function () {
  if (openPopup) { openPopup.close(); }
  if (openModal) { openModal.close(); }

  openPopup = null;
  openModal = null;

  window.clearInterval(closeInterval);
};

/**
 * Pop open an authentication window. It adds some additional safe guards such
 * as catching blocked popup windows, listening for window closes, simplified
 * window positioning, etc.
 *
 * @return {Object} Execute `close` when the window is safe to cleared.
 */
module.exports = function (url, options, cb) {
  var width     = Math.min(720, window.screen.availWidth);
  var height    = Math.min(480, window.screen.availHeight);
  var top       = Math.min(100, (window.screen.availHeight - height) / 2);
  var left      = (window.screen.availWidth - width) / 2;
  var completed = false;

  /**
   * Close all the open modals and popups.
   *
   * @param  {Error}    err
   * @return {Function}
   */
  var done = function (err) {
    closeAll();
    return cb(err);
  };

  // Close previously open popup windows and modals.
  closeAll();

  var modalOptions = _.extend({
    title: 'Request API Permission',
    content: [
      '<p>',
      'Please grant access to this application to make an API request.',
      '</p>',
      '<p>',
      'Click the "Authenticate" button to approve the use of your credentials.',
      'You can revoke these permissions at any time.',
      '</p>',
    ].join('\n'),
    btnText: 'Authenticate',
    show: function (modal) {
      openModal = modal;

      // Open a popup window when the authentication button is pressed.
      Backbone.$(modal.el).on('click', '[data-authenticate]', function () {
        openPopup = window.open(
          url, '', [
            'top=' + top,
            'left=' + left,
            'width=' + width,
            'height=' + height,
            'scrollbars=1'
          ].join(',')
        );

        if (typeof openPopup !== 'object') {
          openPopup = null;
          return done(new Error('Popup window blocked'));
        }

        // Catch window closes before authentication is complete.
        closeInterval = window.setInterval(function () {
          if (openPopup.closed) {
            openPopup = null;
            return done(new Error('Popup window closed'));
          }
        }, 400);
      });
    }
  }, options.modal);


  modalOptions.content += [
    '<div class="text-center">',
    '<button class="btn btn-primary" data-authenticate>',
    modalOptions.btnText,
    '</button>',
    '</div>'
  ].join('\n');

  middleware.trigger('ui:modal', modalOptions, function () {
    openModal = null;
    return !completed && done(new Error('Modal closed without authenticating'));
  });

  return {
    close: function () {
      // Set completed to true so we won't cause an error callback.
      completed = true;

      // Remove any references to open modals and windows.
      return closeAll();
    }
  };
};
