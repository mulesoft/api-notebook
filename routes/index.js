/**
 * Define all routes in the app.
 * @param {object} app Express application instance.
 * @param {object} github GitHub API client instance.
 */
module.exports = function(app, github) {
  require('./auth')(app);
  require('./rest')(app, github);
  require('./views')(app);
};

