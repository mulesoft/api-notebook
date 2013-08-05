/**
 * Auth routes.
 * Documentation on passportjs can be found at http://passportjs.org/.
 * @module
 * @param {object} app Express application instance.
 */
module.exports = function (app) {
  var config = require('../config');
  var passport = require('passport');

  /**
   * GET /login
   * Render login view.
   */
  app.get('/login', function(req, res){
    res.render('login', { user: req.user });
  });

  /**
   * GET /logout
   * Log user out.
   */
  app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });

  /**
   * GET /auth/github
   * Use passport.authenticate() as route middleware to authenticate the
   * request.  The first step in GitHub authentication will involve redirecting
   * the user to github.com.  After authorization, GitHubwill redirect the user
   * back to this application at config.clients.github.callbackRoute.
   */
  app.get('/auth/github',
    passport.authenticate('github'),
    function(req, res){
      // The request will be redirected to GitHub for authentication, so this
      // function will not be called.
  });

  /**
   * GET config.clients.github.callbackRoute
   * Use passport.authenticate() as route middleware to authenticate the
   * request.  If authentication fails, the user will be redirected back to the
   * login page.  Otherwise, the primary route function function will be called,
   * which, in this example, will redirect the user to the home page.
   */
  app.get(config.clients.github.callbackRoute,
    passport.authenticate('github', { failureRedirect: '/login' }),
    function(req, res) {
      res.redirect('/');
    });
};
