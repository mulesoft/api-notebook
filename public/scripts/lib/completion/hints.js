var _          = require('underscore');
var Backbone   = require('backbone');
var state      = require('../../state/state');
var middleware = require('../../state/middleware');
var HintDocs   = require('./hint-documentation');

/**
 * Create a hints popover.
 *
 * @param  {Widget} widget
 * @param  {Array}  results
 * @return {Hints}
 */
var Hints = module.exports = function (widget, results) {
  var that  = this;
  var cm    = this.cm    = widget.completion.cm;
  var hints = this.hints = document.createElement('ul');
  var data  = this.data  = widget.data;
  var text  = cm.getRange(data.from, data.to);

  this.widget = widget;

  _.each(this.results = results, function (result, index) {
    var el     = hints.appendChild(document.createElement('li'));
    var hintEl = document.createElement('span');
    var indexOf;

    el.hintId        = index;
    el.className     = 'CodeMirror-hint';
    hintEl.className = 'CodeMirror-hint-text';

    if ((indexOf = result.title.indexOf(text)) > -1) {
      var prefix  = result.title.substr(0, indexOf);
      var match   = result.title.substr(indexOf, text.length);
      var suffix  = result.title.substr(indexOf + text.length);
      var matchEl = document.createElement('span');

      matchEl.className   = 'CodeMirror-hint-match';
      matchEl.textContent = match;

      hintEl.appendChild(document.createTextNode(prefix));
      hintEl.appendChild(matchEl);
      hintEl.appendChild(document.createTextNode(suffix));
    } else {
      hintEl.textContent = result.title;
    }

    el.appendChild(hintEl);

    if (result.type) {
      var typeEl = document.createElement('span');
      typeEl.className   = 'CodeMirror-hint-type';
      typeEl.textContent = result.type;

      el.appendChild(typeEl);
    }
  });

  hints.className = 'CodeMirror-hints';
  hints.setAttribute('data-overflow-scroll', 'true');
  document.body.appendChild(hints);

  cm.addKeyMap(this.keyMap = {
    'Up':     function () { that.select(that.currentHint - 1); },
    'Down':   function () { that.select(that.currentHint + 1); },
    'Home':   function () { that.select(0); },
    'End':    function () { that.select(-1); },
    'Enter':  function () { that.accept(that.currentHint); },
    'PageUp': function () {
      that.select(that.currentHint - that.screenAmount(), true);
    },
    'PageDown': function () {
      that.select(that.currentHint + that.screenAmount(), true);
    }
  });

  Backbone.$(hints)
    .on('click', 'li', function (e, target) {
      if (isNaN(target.hintId)) {
        return;
      }

      that.accept(target.hintId);
    })
    .on('mousedown', function () {
      window.setTimeout(function () { cm.focus(); }, 20);
    });

  this.listenTo(state, 'change:viewportWidth',  this.reposition);
  this.listenTo(state, 'change:viewportHeight', this.reposition);
  this.listenTo(state, 'change:documentWidth',  this.reposition);
  this.listenTo(state, 'change:documentHeight', this.reposition);

  this.select(0);
  this.reposition();
};

/**
 * Inherit events from Backbone.
 */
_.extend(Hints.prototype, Backbone.Events);

/**
 * Accept a hint result.
 *
 * @param {Number} index
 */
Hints.prototype.accept = function (index) {
  this.trigger('accept', this.results[index]);
};

/**
 * Select a hint option.
 *
 * @param {Number}  index
 * @param {Boolean} noWrap
 */
Hints.prototype.select = function (index, noWrap) {
  var that  = this;
  var data  = this.data;
  var total = this.hints.childNodes.length;

  // Convert the index to the closest number usable number.
  index = index % total;

  // Avoid wrapping around the menu.
  if (noWrap && (index < 0 || index > total)) {
    return;
  }

  // When we have a negative number, we need to subtract it from the bottom
  // of the hints menu. This gives us the looping around effect.
  if (index < 0) {
    index = total + index;
  }

  // Avoid resetting the currently selected hint.
  if (this.currentHint === index) {
    return;
  }

  // Remove the old active hint if we have a selected hint id.
  if (!isNaN(this.currentHint)) {
    this.removeDocumentation();

    var old = this.hints.childNodes[this.currentHint];
    old.className = old.className.replace(' CodeMirror-hint-active', '');
  }

  // Add the class to the new active hint
  var node = this.hints.childNodes[this.currentHint = index];
  node.className += ' CodeMirror-hint-active';

  var result = this.results[this.currentHint];

  this.trigger('select', result);

  if (node.offsetTop < this.hints.scrollTop) {
    this.hints.scrollTop = node.offsetTop - 3;
  } else {
    var totalOffset = node.offsetTop + node.offsetHeight;
    if (totalOffset > this.hints.scrollTop + this.hints.clientHeight) {
      this.hints.scrollTop = totalOffset - this.hints.clientHeight + 3;
    }
  }

  middleware.trigger(
    'completion:describe',
    _.extend({}, this.widget.completion.options, {
      parent: data.context,
      context: null,
      token: _.extend({}, data.token, {
        string: result.value
      })
    }),
    function (err, describe) {
      // Avoid attaching obscure documentation.
      if (err || !describe || (!describe['!type'] && !describe['!doc'])) {
        return;
      }

      that.documentation = new HintDocs(that, describe);
    },
    true
  );
};

/**
 * Update the hint positioning.
 */
Hints.prototype.reposition = function () {
  var cm      = this.cm;
  var pos     = cm.cursorCoords(this.data.from, 'window');
  var hints   = this.hints;
  var margin  = parseInt(window.getComputedStyle(hints).marginTop, 10);
  var scrollY = window.scrollY;
  var scrollX = window.scrollX;

  hints.className    = hints.className.replace(' CodeMirror-hints-top', '');
  hints.style.top    = scrollY + pos.bottom - margin + 'px';
  hints.style.left   = scrollX + pos.left - margin + 'px';
  hints.style.right  = 'auto';
  hints.style.bottom = 'auto';
  hints.style.width  = 'auto';
  hints.style.height = 'auto';

  var box       = hints.getBoundingClientRect();
  var winWidth  = state.get('viewportWidth');
  var winHeight = state.get('viewportHeight');
  var docWidth  = state.get('documentWidth');
  var docHeight = state.get('documentHeight');
  var height    = box.bottom - box.top;

  if (pos.top > winHeight - pos.bottom - margin) {
    hints.className += ' CodeMirror-hints-top';

    if (height + margin > pos.top) {
      hints.style.height = pos.top - margin + 'px';
    }

    hints.style.top    = 'auto';
    hints.style.bottom = docHeight - pos.top - scrollY - margin + 'px';
  } else if (height + margin > winHeight - pos.bottom) {
    hints.style.height = winHeight - pos.bottom - margin + 'px';
  }

  if (box.right + margin > winWidth) {
    hints.style.left  = 'auto';
    hints.style.right = docWidth - scrollX - winWidth + 'px';
  }

  this.trigger('reposition');
};

/**
 * Return the number of hints the current menu is displaying.
 *
 * @return {Number}
 */
Hints.prototype.screenAmount = function () {
  var amount = this.hints.clientHeight / this.hints.firstChild.offsetHeight;
  return Math.max(Math.floor(amount), 1);
};

/**
 * Remove the documentation widget from the DOM.
 */
Hints.prototype.removeDocumentation = function () {
  if (this.documentation) {
    this.documentation.remove();
  }
};

/**
 * Remove the hints menu.
 */
Hints.prototype.remove = function () {
  this.removeDocumentation();
  this.stopListening();
  this.cm.removeKeyMap(this.keyMap);
  document.body.removeChild(this.hints);
  delete this.hints;
  delete this.keyMap;
  delete this.widget.hints;
};
