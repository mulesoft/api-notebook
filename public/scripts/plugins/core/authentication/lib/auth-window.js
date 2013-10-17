/**
 * Keep track of open popup windows so we only have one open at a time.
 *
 * @type {Object}
 */
var openPopup;

/**
 * Pop open an authentication window. It adds some additional safe guards such
 * as catching blocked popup windows, listening for window closes, simplified
 * window positioning, etc.
 *
 * @return {Object} Execute `close` when the window is safe to clear.
 */
module.exports = function (url, cb) {
  var width  = 720;
  var height = 480;
  var left   = (window.screen.availWidth - width) / 2;

  // Close any previously open popup windows.
  if (openPopup) {
    openPopup.close();
  }

  openPopup = window.open(
    url, '', 'left=' + left + ',top=100,width=' + width + ',height=' + height
  );

  if (typeof openPopup !== 'object') {
    return cb(new Error('Popup window blocked'));
  }

  // Catch the client closing the window before authentication is complete.
  var closeInterval = window.setInterval(function () {
    if (openPopup.closed) {
      window.clearInterval(closeInterval);
      return cb(new Error('Popup window closed'));
    }
  }, 400);

  return {
    close: function () {
      openPopup = null;
      window.clearInterval(closeInterval);
    }
  };
};
