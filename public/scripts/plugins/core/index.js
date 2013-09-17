/**
 * Attaches all the core middleware.
 *
 * @param  {Object} middleware
 */
module.exports = function (middleware) {
  require('./ajax')(middleware);
  require('./sandbox')(middleware);
  require('./completion')(middleware);
  require('./result-cell')(middleware);
  require('./persistence')(middleware);
  require('./authentication')(middleware);
};
