/**
 * Templated view routes.
 * @module
 * @param {object} app Express application instance.
 * @param {object} github GitHub API client instance.
 */
module.exports = function (app, github) {

  /**
   * Return a common callback for REST routes.
   * @param  {object} res An Express response object.
   * @return {function} Github API callback.
   */
  function getResultCallback(req, res) {
    var path = req.route.path;
    var method = req.route.method;
    return function renderCallResult(error, gistData) {
      if (error) {
        console.error("Error:", error, "Method:", method, "Path:", path);
        res.send(error);
      } else {
        res.send(gistData);
      }
    };
  }

  /**
   * Return a {object} msg to emit to Github API for POST or PUT call.
   * @param {object} body A JSON object with the following properties:
   *  - gistBody
   *  - [gistDescription] optional
   *  - gistName
   *  - [public]          optional: default true
   * @return {object}
   */
  function gistFromRequestBody(body) {
    var files = {};
    var public = (typeof body.public === 'boolean') ? body.public : true;

    files[body.gistName] = {
      content: body.gistBody
    };

    return {
      description: body.gistDescription,
      public: public,
      files: files
    };
  }

  /**
   * GET /gists
   * Retrieve all Gists for logged-in user.
   */
  app.get('/gists', app.ensureAuthenticated, function(req, res) {
    github.gists.getAll({}, getResultCallback(req, res));
  });

  /**
   * GET /gists/:id
   * Retrieve a Gist with a specific id.
   */
  app.get('/gists/:id', app.ensureAuthenticated, function(req, res) {
    var gist = { "id": req.params.id };
    github.gists.get(gist, getResultCallback(req, res));
  });

  /**
   * DEL /gists/:id
   * Delete a Gist with a specific ID.
   * Logged in user must have write access to the Gist.
  */
  app.delete('/gists/:id', app.ensureAuthenticated, function(req, res) {
    var gist = { "id": req.params.id };
    github.gists.delete(gist, getResultCallback(req, res));
  });

  /**
   * PUT /gists/:id
   * Update a Gist with a given ID.
   * Logged in user must have write access to the Gist.
   */
  app.put('/gists/:id', app.ensureAuthenticated, function(req, res) {
    var gist = gistFromRequestBody(req.body);
    gist.id = req.params.id;
    github.gists.edit(gist, getResultCallback(req, res));
  });

  /**
   * POST /gists
   * Create a Gist for logged-in user.
   */
  app.post('/gists', app.ensureAuthenticated, function(req, res) {
    var gist = gistFromRequestBody(req.body);
    github.gists.create(gist, getResultCallback(req, res));
  });
};
