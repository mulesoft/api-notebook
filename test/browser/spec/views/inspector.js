/* global describe, it */

describe('Inspector', function () {
  var Inspector = App.View.Inspector;
  var fixture   = document.getElementById('fixture');

  it('should exist', function () {
    expect(Inspector).to.be.a('function');
  });

  describe('functionality', function () {
    var matchPreview = function (inspector, output) {
      var el = inspector.el.childNodes[1].getElementsByClassName('inspect')[0];
      if (output instanceof RegExp) {
        expect(el.textContent).to.match(output);
      } else {
        expect(el.textContent).to.equal(output);
      }
    };

    var inputOutput = function (input, output, done) {
      var inspector = new Inspector({ inspect: input, context: window });
      matchPreview(inspector.render(), output);
    };

    it('should inspect string', function () {
      inputOutput('test', '"test"');
    });

    it('should inspect null', function () {
      inputOutput(null, 'null');
    });

    it('should inspect undefined', function () {
      inputOutput(undefined, 'undefined');
    });

    it('should inspect numbers', function () {
      inputOutput(55, '55');
    });

    it('should inspect booleans', function () {
      inputOutput(true, 'true');
    });

    it('should inspect arrays', function () {
      inputOutput([1, 2, 3], '[1, 2, 3]');
    });

    it('should inspect objects', function () {
      inputOutput({ testing: true }, 'Object {"testing": true}');
    });

    it('should inspect functions', function () {
      inputOutput(
        function () { return 'test'; },
        'function () { return \'test\'; }'
      );
    });

    it('should inspect dates', function () {
      inputOutput(
        new Date(1995, 11, 17, 3, 24, 0),
        /^Sun Dec 17 1995 03:24:00/
      );
    });

    it('should inspect regular expressions', function () {
      inputOutput(/test/i, '/test/i');
      inputOutput(/(passing)?/, '/(passing)?/');
    });

    it('should inspect errors', function () {
      inputOutput(new Error('Test Error'), 'Error: Test Error');
    });

    it('should inspect dom elements', function () {
      inputOutput(document.createElement('div'), '<div></div>');
    });

    it('should inspect comment nodes', function () {
      inputOutput(document.createComment(' Test '), '<!-- Test -->');
    });

    it('should inspect doctype nodes', function () {
      inputOutput(document.childNodes[0], /!doctype html/i);
    });

    it('should inspect document nodes', function () {
      inputOutput(document, /!doctype html/i);
    });

    it('should inspect attribute nodes', function () {
      inputOutput(document.createAttribute('test'), /^test/);
    });

    describe('rendering properties', function () {
      var inputOutputChildren = function (input, properties) {
        var inspector = new Inspector({ inspect: input, context: window });
        inspector.render();
        inspector.trigger('open');

        var props = inspector.children;

        prop:
        for (var prop in properties) {
          for (var i = 0; i < props.length; i++) {
            if (props[i].property === prop) {
              matchPreview(props[i], properties[prop]);
              continue prop;
            }
          }
          throw new Error('Property not found.');
        }
      };

      it('should inspect object properties', function () {
        inputOutputChildren({ test: true }, {
          'test': 'true'
        });
      });

      it('should render the `window`', function () {
        inputOutputChildren(window, {
          'window': /^(?:Window|DOMWindow)$/,
          'document': 'HTMLDocument',
          'Infinity': 'Infinity',
          'innerHeight': /^\d+$/
        });
      });

      it('should inspect known list lengths', function () {
        inputOutputChildren({
          array: [],
          nodes: document.getElementsByTagName('*'),
          collection: document.forms
        }, {
          'array': 'Array[0]',
          'nodes': /^NodeList\[\d+\]$/,
          // Can't detect a `HTMLCollection` under PhantomJS.
          'collection': /^(HTMLCollection\[\d+\]|Object)$/
        });
      });

      it('should not render duplicate properties', function () {
        var inspector = new Inspector({ inspect: document, context: window });
        inspector.render();
        inspector.trigger('open');

        var properties = App._.map(inspector.children, function (child) {
          // Element => Preview => Prefix => Property Name
          return child.el.childNodes[1].childNodes[0].textContent;
        });

        expect(properties.length).to.equal(App._.uniq(properties).length);
      });
    });

    describe('rendering prototypes', function () {
      var inputOutputPrototype = function (input, prototype) {
        var inspector = new Inspector({ inspect: input, context: window });
        inspector.render();
        inspector.trigger('open');

        var proto = inspector.children[inspector.children.length - 1];
        proto.trigger('open');

        prop:
        for (var prop in prototype) {
          for (var i = 0; i < proto.children.length; i++) {
            if (proto.children[i].property === prop) {
              matchPreview(proto.children[i], prototype[prop]);
              continue prop;
            }
          }
          throw new Error('Prototype property not found.');
        }
      };

      it('should inspect object prototypes', function () {
        inputOutputPrototype({}, {
          'valueOf':        ('' + {}.valueOf).replace(/\n/g, '↵'),
          'toString':       ('' + {}.toString).replace(/\n/g, '↵'),
          'hasOwnProperty': ('' + {}.hasOwnProperty).replace(/\n/g, '↵')
        });
      });
    });
  });
});
