# JSNotebook

## Development

```bash
# Install dependencies
npm install
bower install
# Running tests in the browser (requires the server running for embed tests)
open test/index.html
# Run static check and headless tests
grunt check && grunt test
```

## Environment Variables

```
export NOTEBOOK_URL="http://localhost:8000" # Set this before building any scripts
export GITHUB_CLIENT_ID=""
export GITHUB_CLIENT_SECRET=""
```

[Register a new application on Github](https://github.com/settings/applications/new), then export the keys in your `.bash_profile`.

## Deployment

To deploy to Heroku, you will need to add some environment variables:

```
export DEPLOY_NOTEBOOK_URL=""
export DEPLOY_GITHUB_CLIENT_ID=""
export DEPLOY_GITHUB_CLIENT_SECRET=""
```

You will need to set your environment variables on your Heroku instance. Run `grunt deploy` to deploy the application to Heroku.

## Basic Authentication

Enabling basic authentication to password protect the notebook requires adding an entry to your environment variables.

```bash
export BASIC_AUTH="test:test another:test"
```

A single user is specified by separating the username and password with a single colon. E.g. `username:password`. To have multiple users, append to the string with a single space between each user.
