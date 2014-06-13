/**
 * Inserts a DOM node after another node.
 *
 * @param  {Node} el
 * @param  {Node} before
 * @return {Node}
 */
module.exports = function (el, before) {
  return before.parentNode.insertBefore(el, before.nextSibling);
};
