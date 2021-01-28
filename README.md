# API Notebook

[![Build Status](https://travis-ci.org/mulesoft/api-notebook.svg)](https://travis-ci.org/mulesoft/api-notebook)

Interactive API notebook - [demo](https://apinotebook.com).

## Development

```
# Install dependencies
npm install
npm install -g grunt-cli

# Start development server
grunt
# open http://localhost:3000

# Run tests in the browser (requires the server to be running)
open test/index.html

# Run headless tests
grunt test
```

Remember to add a new config file (E.g. `config/development.json`) to get up and running. For example, here is my development config (with secret keys omitted, you'll have to find your own set).

```json
{
  "application": {
    "url": "http://localhost:3000"
  },
  "plugins": {
    "ramlClient": {
      "oauth1": {
        "https://api.twitter.com/oauth/authorize": {
          "consumerKey": "...",
          "consumerSecret": "..."
        }
      },
      "oauth2": {
        "https://github.com/login/oauth/authorize": {
          "scopes": ["user", "public_repo", "repo:status", "notifications", "gist"],
          "clientId": "...",
          "clientSecret": "..."
        },
        "https://www.box.com/api/oauth2/authorize": {
          "clientId": "...",
          "clientSecret": "...",
          "redirectUri": "https://api-notebook.anypoint.mulesoft.com/authenticate/oauth.html"
        }
      }
    },
    "proxy": {
      "url": "/proxy"
    },
    "github": {
      "clientId": "...",
      "clientSecret": "..."
    }
  }
}
```

### Sources

The project is split with multiple HTML files acting as entry points to fulfil the embedded requirement of the API Notebook. For example, `src/index.html` is the most feature complete page featuring all the available plugins and rendering in "page" mode, while `src/embedded.html` is an example of the notebook running in "embedded" mode. Finally, `src/embed.html` should never be opened directly but it is the rendered notebook that usually resides inside the `<iframe>` instance.

## Configuration

Project configuration is through [node-config](https://github.com/lorenwest/node-config). To add or override config options, just add a file for your environment (E.g. `development.json`). All plugin config options should be stored under the `plugins` key, while other options are depicted in the `example.json` and `default.json` files.

To use the GitHub plugin functionality, [register a new application on Github](https://github.com/settings/applications/new) and set your keys in under `plugins.github`. Make sure that your new application has the application.url as Authorization callback URL. 
