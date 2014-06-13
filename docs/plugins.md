# Plugins

Plugins can be registered using Express.js-style middleware hooks. Instead of registering routes, we'll be listening for event names.

Middleware is registered using `.use` and accepts up to three parameters. `data`, `next` and `done` are passed to every middleware instance. The `data` is a configuration object the middleware stack was triggered with, while `next` and `done` are middleware flow functions. `next` passes execution off to the next function in the middleware stack and `done` stops the middleware execution stack at the current function (no more processing should occur to the data).

Both `next` and `done` accept up to two arguments, `error` and `data`. If `error` is provided, the middleware will only execute listeners with four arguments (the first parameter being `error`). If data is passed in, it will update the internal `data` object being passed around. In general, `data` should only be passed with `done` callbacks.

## Built-in Middleware Events

### Completion

**completion:filter**

Filters completion suggestions from being displayed. If the middleware can process it, pass a boolean result to `done`. Otherwise ignore it and call `next`.

**completion:variable**

Augment a variable name lookup with custom results. A property called `results` is passed with the `data` object and should be augmented with available variable names.

**completion:context**

Augment the property context lookup, which is used as the object of property lookups. Set the `context` property on the `data` object to the current context.

**completion:property**

Augment a property name lookup with custom results. Works the same as `completion:variable`, but you will probably want to use the `context` property (which is the current object).

**completion:arguments**

Inject an array of arguments to be used as completion results.

**completion:describe**

Describe any variable or property using Tern.js definition notation.

### Inspector

**inspector:filter**

Filter properties from displaying in the inspector. If the middleware can process it, pass a boolean to `done`. Otherwise ignore it and call `next`.

### Result Cells

**result:render**

Render the result or error of a code cell execution. If the middleware can handle it, pass the view to `done`. It will be passed back during `empty` for you to remove.

**result:empty**

Remove the result of a code cell execution. Passes back the data from `result:render`.

### Persistence Layer

**persistence:change**

Triggers every time the notebook contents change. Passes through all the notebook contents for working with. It will not call `change` again while a previous trigger is still executing. This allows you to pass the change event off to save without any side effects.

**persistence:serialize**

Serialize the collection of cells into a format that can be sent to the server. Gets passed all notebook data, except `contents` (since that is the field you need to update).

**persistence:deserialize**

Deserialize data from the server into an array of cells the notebook collection can consume. Gets passed the `contents` string and should set the persistence variables based on the parsed data.

**persistence:authenticate**

Triggers an authentication check of the user. Set the `userId` property on the data object to authenticated user id, or leave `null` if the user authentication failed.

**persistence:authenticated**

Load the initial persistence layer session. It does not trigger any sort of authentication and is only used to check if we have a valid session. Passes through all notebook data and expects the `userId` to be set if the session is active.

**persistence:load**

Load a notebook from somewhere. Gets passed the notebook id and user id and expects you to set the `contents` and `ownerId` properties.

**persistence:save**

Save a notebook to somewhere. Gets passed all notebook data.

**persistence:loadId**

Load the initial url and id to start the application.

**persistence:syncId**

An event triggered when the url needed to be synced with the application.

### Ajax

**ajax**

Sends an ajax request that will be responded to with the ajax object. Allows you to intercept ajax requests before they are sent, but you probably won't want to call `done` - otherwise the ajax request will never be sent. Some of the options passed to the ajax method include `timeout`, `method`, `url`, `async`, `headers`, `data` and `beforeSend`.

### OAuth1

**authenticate:oauth1**

Triggers the full OAuth1 authentication flow and returns the tokens, etc.

**ajax:oauth1**

A simple extension of the `ajax` middleware to provide OAuth1 request signing. Provide the OAuth1 configuration object under the `oauth1` property.

### OAuth2

**authenticate:oauth2**

Triggers the full OAuth2 authentication flow and returns the access token, etc.

**ajax:oauth2**

An extension of the `ajax` middleware that provides signing of OAuth2 requests. Provide the OAuth2 configuration object under the `oauth2` property.

### Sandbox Execution

**sandbox:context**

Provides additional context variables for the sandbox. The data object in this case is the direct context object and can be augmented directly. *Please note: This is also triggered by the code cell to get additional completion data.*

**sandbox:execute**

Triggered for code cell execution, it passes through an object with the executing `code`, `context` and `window` environment. That would allow you to intercept code executions and augment with your own code. Like with the `ajax` middleware, calling `done` here will skip execution all together.

### User Interface

**ui:modal**

Open an interactive modal window for displaying html.
