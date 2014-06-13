var Backbone = require('backbone');

/**
 * Scroll an element vertically based on a wheel event object.
 *
 * @param {Object}  e
 * @param {Element} el
 * @param {Boolean} block
 */
var scrollVertical = function (e, el, block) {
  if (!block) {
    // Hasn't scrolled up or down.
    if (e.deltaY === 0) {
      return;
    }

    // Attempting to scroll up.
    if (e.deltaY < 0 && el.scrollTop === 0) {
      return;
    }

    // Attempting to scroll down.
    if (e.deltaY > 0 && el.scrollTop === el.scrollHeight - el.clientHeight) {
      return;
    }
  }

  e.preventDefault();
  el.scrollTop += e.deltaY;
};

/**
 * Scroll an element horizontally based on a wheel event object.
 *
 * @param {Object}  e
 * @param {Element} el
 * @param {Boolean} block
 */
var scrollHorizontal = function (e, el, block) {
  if (!block) {
    // Hasn't scrolled left or right.
    if (e.deltaX === 0) {
      return;
    }

    // Attempting to scroll left.
    if (e.deltaX < 0 && el.scrollLeft === 0) {
      return;
    }

    // Attempting to scroll right.
    if (e.deltaX > 0 && el.scrollLeft === el.scrollWidth - el.clientWidth) {
      return;
    }
  }

  e.preventDefault();
  el.scrollLeft += e.deltaX;
};

/**
 * Bind to the entire document and just listen for a data attribute.
 */
Backbone.$(document)
  .on('wheel', '[data-overflow-scroll]', function (e, el) {
    var block = !!el.getAttribute('data-overflow-scroll');

    scrollVertical(e, el, block);
    scrollHorizontal(e, el, block);
  });
