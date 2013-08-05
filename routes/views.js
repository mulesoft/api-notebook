/**
 * Templated view routes.
 * @module
 * @param {object} app Express application instance.
 */
module.exports = function (app) {

  /**
   * Render index view.
   */
  app.get('/', function(req, res){
    res.render('index', {user: req.user});
  });

  /**
   * Render user account information.
   */
  app.get('/account', app.ensureAuthenticated, function(req, res){
    res.render('account', { user: req.user });
  });
};