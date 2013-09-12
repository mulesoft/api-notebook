# JSNotebook

## Development

```bash
# Install dependencies
npm install
bower install
# Run tests in the browser (requires server running for embed tests)
open test/index.html
# Run headless tests
grunt check
```

## Environment Variables

```
export NOTEBOOK_URL="http://localhost:8000" # Set this before building any scripts
export GITHUB_CLIENT_ID=""
export GITHUB_CLIENT_SECRET=""
```

[Register a new application on Github](https://github.com/settings/applications/new), then export the keys in your `.bash_profile`.

## Embeddable Widget

Simple use, requires only a single script tag on the embedding page. However, we probably need to change selector to element id or similar since selector is hardly cross-browser. Be aware that since all attributes will come out as strings, you can't pass through custom styles or anything more advanced.

```html
<script src="embed.js" data-selector="body" data-id="abc"></script>
```

More advanced use case allows for programmatic creation of notebooks.

```javascript
new Notebook(el, {
  id:      '123',
  content: '# Fallback Markdown Content',
  style: {
    minWidth: '320px',
    minHeight: '200px'
  },
  alias: {
    $: window.jQuery
  }
})
```

## Deployment

To deploy to Heroku, just run the deploy script in the Makefile. You will probably have to set your the environment variables on Heroku, as well as update the git endpoint in the Makefile.
