# API Notebook

## Development

```bash
# Install dependencies
npm install
# Run tests in the browser (requires the server to be running)
open test/index.html
# Run headless tests
grunt test
```

## Configuration

The project configuration is done using [node-config](https://github.com/lorenwest/node-config). To add or override config options, just add a file for your environment (E.g. `development.json`). All plugin config options should be stored under the `plugins` key, while other options are depicted in the `example.json` and `default.json` files.

To use the github plugin functionality, [register a new application on Github](https://github.com/settings/applications/new) and set your keys in under `plugins.github`.
