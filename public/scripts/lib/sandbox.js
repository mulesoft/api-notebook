var frame = document.createElement('iframe');
frame.style.display = 'none';

// The iframe needs to be appended to the document before we can use it
document.body.appendChild(frame);

// Allow arbitrary running of strings as code
exports.execute = function (code) {
  /* jshint evil:true */
  return frame.contentWindow.eval(code);
};
