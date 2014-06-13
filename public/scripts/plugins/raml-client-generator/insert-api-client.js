/* global App */
var _          = App.Library._;
var Backbone   = App.Library.Backbone;
var changeCase = App.Library.changeCase;

/**
 * Create an api client cell that can load the selected api document.
 *
 * @param  {Cell}     cell
 * @param  {String}   invoke
 * @return {Function}
 */
var createApiClientCell = function (cell, invoke) {
  return function (err, api) {
    if (err) { return; }

    var url      = api.ramlUrl;
    var variable = changeCase.camelCase(api.title);
    var code     = [
      '// Read about the ' + api.title + ' at ' + api.portalUrl,
      'API.createClient(\'' + variable + '\', \'' + url + '\');'
    ].join('\n');

    var view = cell.notebook[invoke + 'CodeView'](cell.el, code).execute();

    cell.focus();

    // Trigger a raml client insertion message.
    App.messages.trigger('ramlClient:insert');

    return view;
  };
};

/**
 * Load all the API definitions and return the items as an array.
 *
 * @param {Function} done
 */
var loadAPIDefinitions = function (done) {
  return App.middleware.trigger('ajax', {
    url: 'http://api.apihub.com/v1/apis?specFormat=RAML'
  }, function (err, xhr) {
    return done(err, JSON.parse(xhr.responseText).items);
  });
};

/**
 * Show RAML definitions to users in a modal, and upon selection pass the
 * selected definition back to the callback.
 *
 * @param {Function} done
 */
var selectAPIDefinition = function (done) {
  // Trigger modal display messages.
  App.messages.trigger('ramlClient:modal');

  return App.middleware.trigger('ui:modal', {
    title: 'Insert an API Client',
    content: function (done) {
      return loadAPIDefinitions(function (err, items) {
        if (err) { return done(err); }

        return done(null, '<div class="modal-instructions">' +
          'Insert an API client from a RAML specification.' +
          ' An API client is a JavaScript representation of an API' +
          ' that you can use to explore available endpoints and' +
          ' their parameters. ' +
          '<a href="http://raml.org/" target="_blank">' +
          'Learn more about RAML</a>.' +
          '</div>' +
          '<div class="form-group">' +
          '<input class="item-search" placeholder="Search">' +
          '</div>' +
          '<ul class="item-list">' +
          _.map(items, function (item) {
            return '<li data-title="' + item.title + '" ' +
              'data-raml="' + item.specs.RAML.url + '" ' +
              'data-title="' + item.title + '" ' +
              'data-portal="' + item.apihubPortal + '">' +
              '<div class="item-action">' +
              '<a href="#" class="btn btn-primary btn-small">Add</a>' +
              '</div>' +
              '<div class="item-description">' + item.title +
              '<a href="#" class="item-details-link" data-details>details</a>' +
              '<div class="item-details">' + item.description + '</div>' +
              '</div>' +
              '</li>';
          }).join('') + '</ul>' +
          '<p class="hide item-list-unavailable">No matching APIs found. ' +
          'Please search on the <a ' +
          'href="http://api-portal.anypoint.mulesoft.com/" target="_blank">' +
          'Anypoint API Portal</a> and submit a request for more ' +
          'documentation for this API.</p>'
        );
      });
    },
    show: function (modal) {
      Backbone.$(modal.el)
        .on('click', '[data-details]', function (e, target) {
          e.preventDefault();
          e.stopImmediatePropagation();

          var classList = target.parentNode.parentNode.classList;

          if (!classList.contains('item-details-visible')) {
            classList.add('item-details-visible');
          } else {
            classList.remove('item-details-visible');
          }
        })
        .on('click', '[data-raml]', function (e, target) {
          e.preventDefault();

          // Close the modal behind ourselves.
          modal.close();

          return done(null, {
            title:     target.getAttribute('data-title'),
            ramlUrl:   target.getAttribute('data-raml'),
            portalUrl: target.getAttribute('data-portal')
          });
        })
        .on('keyup', '.item-search', function (e) {
          var listItemEls   = modal.el.querySelectorAll('.item-list > li');
          var unavailableEl = modal.el.querySelector('.item-list-unavailable');

          var hasResults = _.filter(listItemEls, function (el) {
            var title   = el.getAttribute('data-title').toLowerCase();
            var matches = title.indexOf(e.target.value.toLowerCase()) > -1;

            el.classList[matches ? 'remove' : 'add']('hide');
            return matches;
          }).length;

          unavailableEl.classList[hasResults ? 'add' : 'remove']('hide');
        });
    }
  });
};

/**
 * Inserts a new code cell above with a RAML API client and executes it.
 */
App.View.EditorCell.prototype.newRAMLAbove = function () {
  return selectAPIDefinition(createApiClientCell(this, 'prepend'));
};

/**
 * Inserts a new code cell below with a RAML API client and executes it.
 */
App.View.EditorCell.prototype.newRAMLBelow = function () {
  return selectAPIDefinition(createApiClientCell(this, 'append'));
};

/**
 * Insert a RAML document by using the cell border buttons.
 */
App.View.CellButtons.controls.push({
  label:   'Insert API Client',
  command: 'newRAML'
});

/**
 * Insert a RAML document by using the cell menu buttons.
 */
App.View.CodeCell.prototype.cellControls.push({
  label:   'Insert API Client',
  command: 'newRAMLBelow'
});
