module.exports = function (el, before) {
  before.parentNode.insertBefore(el, before.nextSibling);
};
