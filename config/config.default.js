// Default configuration.
var c = module.exports = {};

// TODO remove secrets from source and regenerate secrets.
// https://www.pivotaltracker.com/story/show/54576662
// https://www.pivotaltracker.com/story/show/54576680
c.app = {
  port: 8000,
  sessionSecret: "keyboard cat",
  staticDir: "public"
};

c.clients = {};
c.clients.github = {
  callbackRoute: "/github-callback",
  clientId: "a7f8014691fcc748aced",
  clientSecret: "ea758e7cde897016e56dd816c901d82c82568964",
  timeout: 10000,
  version: "3.0.0"
};
