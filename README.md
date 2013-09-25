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

## Embeddable Widget

Simple use requires only a single script tag on the embedding page. Be aware that since all attributes will come out as strings, you can't pass through any of the more advanced settings that creating notebooks programmatically allows.

```html
<script src="embed.js" data-selector="body" data-id="abc"></script>
```

In the case that you want this simple functionality still, but the initial script tag is asynchronous, just provide a `data-notebook` attribute.

More advanced use case allows for programmatic creation of notebooks:

```javascript
// new Notebook(element, options);

new Notebook(document.getElementById('notebook'), {
  id:      '123',
  content: '# Fallback Markdown Content',
  style: {
    minWidth:  320,
    minHeight: 200
  },
  alias: {
    $: window.jQuery
  }
});
```

A list of all options can be viewed below:

* **id** - An id that can be passed to the persistence layer and load the initial content.
* **style** - An object with all styles to be applied to the frame container.
* **content** - Base content to load in the case that the `id` fails to load or no id was provided.
* **alias** - An object with all variable names and values to alias inside the frame.
* **inject** - An array of script URLs to load before starting the notebook.

## Plugins

Plugins can be registered using Express.js-style middleware hooks. However, instead of registering against routes, we'll be listening for event names.

Middleware is registered using `.use` and accepts up to three parameters. `data`, `next` and `done` are passed to every middleware instance. The `data` is an object that the middleware stack was triggered with, while `next` and `done` are functions. `next` passes execution off to the next function in the middleware stack and `done` stops the middleware execution stack at the current function (in case we have finished the required processing).

Both `next` and `done` accept two arguments, an `error` and a `data` argument. If `error` is provided, the middleware will only execute listeners with four arguments (first paramater being `error`). If data is provided, it will set the internal `data` being passed around. In general, this should only be used with the `done` callback.

Included middleware hooks include:

* **completion:filter** - Filters any completion suggestions from being displayed. If the middleware can process it, pass a boolean result to `done`.
* **completion:variable** - Augment a variable name lookup with custom results. A property called `results` is passed with the `data` object and should be augments with all variable names.
* **completion:context** - Augment a context lookup, which is used for the base object of property lookups. Set the `context` property on the `data` object to the current context.
* **completion:property** - Augment a property name lookup with custom results. Works the same as `completion:variable`, though you will probably want to access the `context` property (which is the current object).
* **inspector:filter** - Filter properties from displaying in the inspector. If the middleware can handle it, pass a boolean to `done`.
* **result:render** - Render the result or error of a code cell execution. If the middleware can handle it, pass the view to `done`. It will be passed back during `empty` for you to use.
* **result:empty** - Remove the result of a code cell execution. Passes through the view from `result:render`.
* **persistence:change** - Every time the notebook contents change. Passes through all the notebook contents.
* **persistence:serialize** - Serialize the collection of cells into a format that can be sent to the server. Gets passed all notebook data, except `notebook` is an array of cells.
* **persistence:deserialize** - Deserialize data from the server into an array of cells the notebook collection can consume. Gets passed all notebook data.
* **persistence:authenticate** - Triggers an authentication check of the user. Set the `userId` property on the data object to authenticated user id.
* **persistence:authenticated** - Used to load an initial session and should not trigger any sort of authentication. Passes through all notebook data, and expects a user id and optional owner id back.
* **persistence:load** - Load a notebook from somewhere. Gets passed the notebook id and user id. It expects you to set the notebook and owner id properties.
* **persistence:save** - Save a notebook to somewhere. Gets passed all notebook data.
* **ajax** - Sends an asynchonous ajax request that will be responded to with the ajax object. Allows you to intercept ajax requests before they are sent, but you probably won't want to call `done` - otherwise the ajax request will never be sent.
* **authenticate:oauth2** - Triggers the oauth2 authentication flow with window popups, etc. Expects you to return an auth object with an `accessToken`.
* **sandbox:context** - Provides additional context variables for the sandbox. The data object in this case is the direct context object and can be augmented directly. *This is also triggered by the code cell to get additional completion data.*
* **sandbox:execute** - Triggered for code cell execution, it passes through an object with the executing `code`, `context` and `window` environment. It would allow you to intercept code executions and augment with your own code. Like with `ajax` middleware, calling `done` here will skip execution all together.

## Cell Execution

* A `load` function is provided which can be used to load script URLs into the execution environment. It accepts a url to load and an optional callback function.
* An `async` function is provided to help with executing async code cells. Executing the function once will return another function and force the cell into async mode. You can then call the returned function with `error` and `result` parameters (in that order) to end the async execution. There is a safeguard timeout of 2000ms (which can be changed by setting the `timeout` variable) that stops the script from never ending in case of a badly writting async function (this won't magically fix async code).

## Deployment

To deploy to Heroku, you will need to add some environment variables:

```
export DEPLOY_GITHUB_CLIENT_ID=""
export DEPLOY_GITHUB_CLIENT_SECRET=""
```

You will need to set your environment variables on your Heroku instance. Run `grunt deploy` to deploy the application to Heroku.
