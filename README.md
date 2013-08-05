jsnotebook
==========

```bash
npm install
npm start
```

Github API proxy implements these REST routes:

`POST /gists` - Create a gist.
`PUT /gists/:id` - Edit a specific gist.
`DELETE /gists/:id` - Remove a specific gist.
`GET /gists` - Retrieve all gists for logged-in user).
`GET /gists/:id` - Retrieve a specific gist.

Authentication is done via a browser by navigating to
[http://localhost:8000/auth/github](http://localhost:8000/auth/github).
A cookie-based session is established. Calls to the REST API can be made via the
browser after authentication. Test API using e.g.
[REST console](https://chrome.google.com/webstore/detail/rest-console/cokgbflfommojglbmbpenpphppikmonn?hl=en).

