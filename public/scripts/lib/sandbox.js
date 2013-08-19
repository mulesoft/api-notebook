var Sandbox = module.exports = function () {
  this.createFrame();
};

Sandbox.prototype.createFrame = function () {
  this.frame = document.createElement('iframe');
  this.frame.style.display = 'none';
  document.body.appendChild(this.frame);
  this.window = this.frame.contentWindow;
};

Sandbox.prototype.execute = function (code, context) {
  try {
    if (typeof context === 'object') {
      this.window.console = this.window.console || {};
      this.window.console._notebookAPI = context;
      code = 'with (window.console._notebookAPI) {\n' + code + '\n}';
    }

    /* jshint evil: true */
    return this.window.eval(code);
  } catch (error) {
    throw error;
  } finally {
    delete this.window.console._notebookAPI;
  }
};

Sandbox.prototype.remove = function () {
  this.frame.parentNode.removeChild(this.frame);
  delete this.frame;
  delete this.window;
};
