/* global App */
var _          = App.Library._;
var qs         = App.Library.qs;
var domify     = App.Library.domify;
var Backbone   = App.Library.Backbone;
var changeCase = App.Library.changeCase;

var BASE_URI = 'https://anypoint.mulesoft.com/apiplatform/repository/v2' +
  '/public/apis';
var ITEMS_PER_PAGE = 10;

/**
 * Create an api client cell that can load the selected api document.
 *
 * @param  {App.View.EditorCell}     cell
 * @param  {String}   invoke
 * @return {Function}
 */
var createApiClientCell = function (cell, invoke) {
  return function (err, api, version) {
    if (err) { return; }

    // Convert the API name into a variable for use.
    var variable = changeCase.camelCase(api.name);

    // Create the view with api creation details.
    var view = cell.notebook[invoke + 'CodeView'](cell.el, [
      '// Read about the ' + api.name + ' at ' + version.portalUrl,
      'API.createClient(\'' + variable + '\', \'' + version.ramlUrl + '\');'
    ].join('\n')).execute();

    cell.focus();

    // Trigger a raml client insertion message.
    App.messages.trigger('ramlClient:insert');

    return view;
  };
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

  /**
   * The current search specification object, passed to the middleware layer.
   *
   * @type {Object}
   */
  var searchSpec = {
    offset: 0,
    limit:  ITEMS_PER_PAGE,
    query:  ''
  };

  return App.middleware.trigger('ui:modal', {
    title: 'Insert an API Client',
    content: function (done) {
      return done(null, '<div class="modal-instructions">' +
        'Insert an API client from a RAML specification. An API client is ' +
        'a JavaScript representation of an API that you can use to explore ' +
        'available endpoints and their parameters. ' +
        '<a href="https://raml.org/" target="_blank">' +
        'Learn more about RAML</a>.' +
        '</div>' +
        '<div class="form-group">' +
        '<input class="item-search" placeholder="Search">' +
        '</div>' +
        '<div class="items-loading" ' +
        'style="text-align: center; font-size: 3em;">' +
        '<i class="icon-arrows-cw animate-spin"></i>' +
        '</div>' +
        '<div class="items-container clearfix">' +
        '<div class="items-container-total"></div>' +
        '<ul class="items-list"></ul>' +
        '<button class="btn-secondary items-prev-btn" style="float: left">' +
        'Previous</button>' +
        '<button class="btn-secondary items-next-btn" style="float: right">' +
        'Next</button>' +
        '</div>' +
        '<p class="items-unavailable">No matching APIs found.</p>'
      );
    },
    show: function (modal) {
      var itemsEl            = modal.el.querySelector('.items-container');
      var itemsListEl        = itemsEl.querySelector('.items-list');
      var itemsLoadingEl     = modal.el.querySelector('.items-loading');
      var itemsNextBtnEl     = itemsEl.querySelector('.items-next-btn');
      var itemsPrevBtnEl     = itemsEl.querySelector('.items-prev-btn');
      var itemsUnavailableEl = modal.el.querySelector('.items-unavailable');
      var totalItemsEl       = modal.el.querySelector('.items-container-total');
      var searchId;

      /**
       * Load all the API definitions and return the items as an array.
       *
       * @param {Object} search
       * @param {Function} done
       */
      var loadAPIDefinitions = function (search, done) {
        var currentSearchId = Math.random();

        // Track current search index.
        searchId = currentSearchId;

        // Reset element states and show a loading indicator.
        itemsEl.classList.add('hide');
        itemsUnavailableEl.classList.add('hide');
        itemsLoadingEl.classList.remove('hide');

        // Set both buttons to disabled for now.
        itemsNextBtnEl.setAttribute('disabled', 'disabled');
        itemsPrevBtnEl.setAttribute('disabled', 'disabled');

        return App.middleware.trigger(
          'ramlClient:search',
          search,
          function (err, data) {
            // Skip updates when the ID has changed.
            if (currentSearchId !== searchId) {
              return;
            }

            return done(err, data);
          }
        );
      };

      /**
       * Render the search results.
       *
       * @param {Error}  err
       * @param {Object} result
       * @param {Number} result.total
       * @param {Array}  result.items
       */
      var updateResults = function (err, result) {
        // Always remove the loading indicator.
        itemsLoadingEl.classList.add('hide');

        // Empty the list before we populate it again.
        itemsListEl.innerHTML = '';
        totalItemsEl.innerHTML = '';

        if (err) {
          return done(err);
        }

        if (result.items.length === 0) {
          return itemsUnavailableEl.classList.remove('hide');
        }

        totalItemsEl.appendChild(document.createTextNode(
          'Showing ' + result.items.length + ' of ' + result.total + ' results'
        ));

        itemsEl.classList.remove('hide');

        // If the offset is past the first page, allow going back.
        if (searchSpec.offset > 0) {
          itemsPrevBtnEl.removeAttribute('disabled');
        }

        // If the offset can still move before hitting the last result, allow.
        if (searchSpec.offset < result.total - searchSpec.limit) {
          itemsNextBtnEl.removeAttribute('disabled');
        }

        // Iterate over each version and append to the item list.
        _.each(result.items, function (item) {
          var name = _.escape(item.name);
          var masterOrg = _.escape(item.versions[0].masterOrganizationName);

          var el = domify([
            '<li>',
            '<div class="item-info clearfix">',
            '<div class="item-action">',
            '<button class="btn btn-primary btn-small item-add">Add</button>',
            '</div>',
            '<a href="#" class="item-link">All versions</a>',
            '<div class="item-name">' +
            name + ' <small>' + masterOrg + '</small>' +
            '</div>',
            '</div>',
            '<div class="item-versions">',
            _.map(item.versions, function (version, index) {
              var name        = _.escape(version.name);
              var description = _.escape(version.description).trim();
              var portalUrl   = _.escape(version.portalUrl);

              return [
                '<div class="item-version clearfix">',
                '<div class="item-action">',
                '<button class="btn btn-primary btn-small item-add" ' +
                'data-index="' + index + '">',
                'Select',
                '</button>',
                '</div>',
                '<a href="' + portalUrl + '" class="item-link ' +
                'item-read-more" target="_blank">Read more</a>',
                '<div class="item-name">',
                description ?
                  '<span class="hint--top" data-hint="' + description + '">' :
                  '',
                name,
                description ? '</span>' : '',
                '</div>',
                '</div>'
              ].join('\n');
            }).join('\n'),
            '</div>',
            '</li>'
          ].join('\n'));

          itemsListEl.appendChild(el);

          // When the element is clicked, render the code cell.
          Backbone.$(el)
            .on('click', function (e) {
              // Do nothing if the read more link is clicked.
              if (e.target.classList.contains('item-read-more')) {
                return;
              }

              // Prevent following of links.
              e.preventDefault();

              var method = 'add';

              // Remove the attribute if it exists.
              if (el.classList.contains('item-visible')) {
                method = 'remove';
              }

              el.classList[method]('item-visible');
            })
            .on('click', '.item-add', function (e, el) {
              modal.close();
              e.stopPropagation();

              // Resolve to the clicked API version, or "latest".
              var version = item.versions[el.getAttribute('data-index') || 0];

              return done(null, item, version);
            });
        });
      };

      Backbone.$(modal.el)
        .on('click', '.items-next-btn', function () {
          return loadAPIDefinitions(_.extend(searchSpec, {
            offset: searchSpec.offset + ITEMS_PER_PAGE
          }), updateResults);
        })
        .on('click', '.items-prev-btn', function () {
          return loadAPIDefinitions(_.extend(searchSpec, {
            offset: searchSpec.offset - ITEMS_PER_PAGE
          }), updateResults);
        })
        .on('keyup', '.item-search', _.throttle(function (e, el) {
          // Avoid updating when the value hasn't changed.
          if (searchSpec.query === el.value) {
            return;
          }

          return loadAPIDefinitions(_.extend(searchSpec, {
            offset: 0,
            query:  el.value
          }), updateResults);
        }, 700));

      return loadAPIDefinitions(searchSpec, updateResults);
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

/**
 * Register the basic raml client search middleware.
 */
App.middleware.register('ramlClient:search', function (search, next, done) {
  var url = BASE_URI + '?' + qs.stringify({
    sort:        'name',
    ascending:   true,
    requireRaml: true,
    limit:       search.limit,
    offset:      search.offset,
    query:       search.query
  });

  return App.middleware.trigger('ajax', {
    url: url
  }, function (err, xhr) {
    var result;
    var data = {};

    if (err) {
      return done(err);
    }

    try {
      result = JSON.parse(xhr.responseText);
    } catch (e) {
      return done(e);
    }

    data.items = result.apis;
    data.total = result.total;

    return done(null, data);
  });
});
