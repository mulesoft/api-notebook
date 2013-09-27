# Embeddable Widget

Simple use requires only a single script tag on the embedding page. Be aware that since all attributes will come out as strings, you can't pass through any of the more advanced settings that creating notebooks programmatically allows.

```html
<script src="embed.js" data-selector="body" data-id="abc"></script>
```

In the case that you want to keep this functionality, but the script tag is asynchronous, just provide a `data-notebook` attribute on the script element.

## Advanced Creation

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

### Options

**id**

An id that can be passed to the persistence layer and load the initial content.

**style**

An object with all styles to be applied to the frame container. **Please note: These styles do not get passed into the frame.**

**content**

The starting content for the notebook to use. Used when `id` fails to load or when no `id` is provided.

**alias**

An object with all variable names and values to alias inside the frame. *Please note: Functions and other advanced JavaScript types can not be passed between frames.*

**inject**

An array of script URLs to load *before* starting the application.
