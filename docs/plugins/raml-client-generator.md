# RAML Client Generator

The RAML client generator exposes an `API` object inside code cells which will load a RAML spec and parse it into a DSL for the API.

## Generate an API client

To generate a new API, you can call the `createClient` function on the `API` object. It accepts up to three arguments, the global variable name, the RAML document URL and a callback function (which defaults to the cell `async` function).

```js
API.createClient('example', '/raml/example.yml');
```

Running the above code will alias `window.example` to the generated API client.

*The RAML spec must be served using CORS if it is on another domain.*

## Using the API Client

The API is generated on the fly depending on the methods you call. This allows you to dynamically call different routes at different points in the code without conflicts.

### Methods

When you are at a point in the API client that you can send a request, the API will expose the relevant method names for you to call as functions. E.g. `get()`, `post()`.

GET and HEAD requests accept an optional query string object as their first parameter, where all other request types accept the request body as the argument. If you omit the `Content-Type` header, the request will attempt to fill it in using the RAML spec. If you pass in an object or array as the request body, it will be serialized to the correct body according to the `Content-Type` header. E.g. If the `Content-Type` is set to `application/json`, the body will be stringified using `JSON.stringify`.

### Headers

Headers can be set at a point when the API can make a valid request. Just pass an object into the `headers` method to set the header values.

### Query String

A query string can be set once the API is at a point that a valid request can be made. Pass an object into the `query` method to set the query string. In a GET or HEAD request, this could be overriden when the request is made. The query string will be validated against the RAML spec before the request is made.

### Requesting any URL

A request can be made to any URL under the RAML documents `baseUri` by executing the API as a function. It accepts two arguments, the path and a context object. The path will be parsed and injected with the context properties according to the [URI Template Spec](https://tools.ietf.org/html/rfc6570)

### Predefined Resources

Resources defined in the RAML spec will be available as properties on the root function. Each resource level in the RAML document as parsed and transformed into a property.

```js
/test
--> .test

/{test}
--> .test("test")

/test{more}
--> .test("more")

/test{even}{more}
--> .test("even", "more")

/test{some}thing{invalid}
--> "Error: Property does not exist."
```

As demonstrated above, routes will generate either properties (for static routes) or methods (for dynamic routes). The number of arguments will match the number of variables that can be injected into the route. If there is text after any variable, the route will not be generated.

## Example Usage

```js
example.collection.collectionId(123).query({
  page: 5
}).headers({
  'User-Agent': 'Collection Collector'
}).get();
```
