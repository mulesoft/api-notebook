/**
 * Loads a script into the document. All functionality must be inlined since
 * it will be evaled into the sandbox context.
 *
 * @param  {String}   src
 * @param  {Function} done
 * @return {Node}
 */
module.exports = function (src, done) {
  var head   = document.head || document.getElementsByTagName('head')[0];
  var script = document.createElement('script');

  script.src     = src;
  script.async   = true;
  script.type    = 'text/javascript';
  script.charset = 'utf8';

  if (done) {
    // If there is no `onload` property to listen to, fall back to listening to
    // state changes in IE.
    if ('onload' in script) {
      script.onload = function () {
        this.onerror = this.onload = null;
        return done();
      };

      script.onerror = function () {
        this.onerror = this.onload = null;
        return done(new Error('Failed to load ' + src));
      };
    } else {
      script.onreadystatechange = function () {
        if (this.readyState !== 'complete') { return; }
        this.onreadystatechange = null;
        // There is no way to catch load errors in IE8.
        return done();
      };
    }
  }

  return head.appendChild(script);
};
