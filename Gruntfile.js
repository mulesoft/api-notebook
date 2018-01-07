var path        = require('path');
var request     = require('request');
var DEV         = process.env.NODE_ENV !== 'production';
var PLUGIN_DIR  = path.join(__dirname, 'src/scripts/plugins');
var BUILD_DIR   = path.join(__dirname, 'build');
var TEST_DIR    = path.join(BUILD_DIR, 'test');
var FIXTURE_DIR = path.join(TEST_DIR, 'fixtures');
var PORT        = process.env.PORT || 3000;
// var util = require('util');

/**
 * Exports the grunt configuration.
 *
 * @param {Object} grunt
 */
module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);

  var _                   = grunt.util._;
  var jsRegex             = /\.js$/;
  var browserifyPlugins   = {};
  var browserifyTransform = [];

  if (!DEV) {
    browserifyTransform.push('hbsify');
    browserifyTransform.push('uglifyify');
  }

  require('fs').readdirSync(PLUGIN_DIR).forEach(function (fileName) {
    if (fileName.charAt(0) === '.') { return; }

    // Remove trailing extension and transform to camelCase
    var name    = _.camelize(fileName.replace(jsRegex, '')) + 'Plugin';
    var inFile  = fileName + (jsRegex.test(fileName) ? '' : '/index.js');
    var outFile = fileName + (jsRegex.test(fileName) ? '' : '.js');

    browserifyPlugins[name] = {
      src:  path.join(PLUGIN_DIR, inFile),
      dest: path.join(BUILD_DIR, 'plugins', outFile),
      options: {
        browserifyOptions: {
          debug:      DEV,
          transform:  browserifyTransform,
          standalone: name
        }
      }
    };
  });

  /**
   * Generic middleware stack for running the connect server grunt tasks.
   *
   * @param  {Object} connect
   * @param  {Object} options
   * @return {Array}
   */
  var serverMiddleware = function (connect, options) {
    var middleware = [];
    var whitelist = ['http:localhost:3000'];

    console.log('Before entering middleware');
    middleware.push(function (req, res, next) {
      console.log('Inside middleware'+req);

      if (req.url.substr(0, 7) !== '/proxy/') {
        return next();
      }

      var proxy = request(req.url.substr(7), {
        rejectUnauthorized: false
      });

      // Proxy the error message back to the client.
      proxy.on('error', function (err) {
        res.writeHead(500);
        return res.end(err.message);
      });

      // Attempt to avoid caching pages.
      proxy.on('response', function (res) {
        if (!res.headers['cache-control']) { return; }

        // Remove cookies from being set in the client.
        delete res.headers['set-cookie'];

        // Remove the max-age and other cache duration directives.
        res.headers['cache-control'] = res.headers['cache-control']
          .replace(/(max-age|s-maxage)=\d+/g, '$1=0');
      });

      // Pipe the request data directly into the proxy request and back to the
      // response object. This avoids having to buffer the request body in cases
      // where they could be unexepectedly large and/or slow.
      return req.pipe(proxy).pipe(res);

    });

    // Enables cross-domain requests.
    middleware.push(function (req, res, next) {
      // regex to validate the receiving hosts
      // https?:\/\/[^/]*\.anypoint\.mulesoft\.com\/(.+) --> qax.anypoint.mulesoft.com, etc
      // https?:\/\/anypoint\.mulesoft\.com\/(.+) --> anypoint.mulesoft.com

      // var str = 'https://qax.anypoint.mulesoft.com/designcenter/' +
      //   'designer/#/project/398a83d1-1934-4caf-8083-1ac4b992ec7e';

      var str = 'http:localhost:3000';
      var re = /https?:\/\/[^/]*\.anypoint\.mulesoft\.com\/(.+)/g;
      var found = str.match(re);

      console.log('Request Origin: ' + req.headers.origin);
      console.log('Matcheo: ' + found);

      if(found){
        res.setHeader('Access-Control-Allow-Origin', whitelist.join(','));
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
      }
      return next();
    });

    // Serve the regular static directory.
    middleware.push(connect.static(options.base));

    return middleware;
  };

  grunt.initConfig({
    /**
     * Remove the directory and any directory contents.
     *
     * @type {Object}
     */
    clean: {
      build: BUILD_DIR
    },

    /**
     * Copy any files required for the built functionality.
     *
     * @type {Object}
     */
    copy: {
      build: {
        files: [
          {
            expand: true,
            cwd: 'src',
            src: ['*.html', 'authenticate/**', 'images/**', 'favicon.ico'],
            dest: 'build/'
          },
          {
            expand: true,
            cwd: 'test/fixtures',
            src: '**',
            dest: FIXTURE_DIR
          },
          {
            expand: true,
            cwd: 'vendor/fontello/font',
            src: ['**/*'],
            dest: 'build/font/'
          }
        ]
      }
    },

    /**
     * Lint all the JavaScript for potential errors.
     *
     * @type {Object}
     */
    jshint: {
      all: {
        src: ['src/**/*.js', '*.js']
      },
      options: {
        jshintrc: '.jshintrc'
      }
    },

    /**
     * Specific shell scripts to run.
     *
     * @type {Object}
     */
    shell: {
      'mocha-browser': {
        command: './node_modules/phantomjs-prebuilt/bin/phantomjs --web-security=false ' +
        './node_modules/mocha-phantomjs-core/mocha-phantomjs-core.js test/index.html spec ' +
        '\'{ \"ignoreResourceErrors\": true }\''
      },
      'build-gh-pages': {
        command: 'NODE_ENV="gh-pages" grunt build'
      },
      'gh-pages': {
        command: [
          'cd ./build',
          'git init .',
          'git add .',
          'git commit -m \"Deploy\"',
          'git push \"git@github.com:mulesoft/api-notebook.git\" ' +
            'master:gh-pages --force; rm -rf .git'
        ].join(' && ')
      }
    },

    /**
     * Browserify all the modules.
     *
     * @type {Object}
     */
    browserify: grunt.util._.extend({
      application: {
        src: 'src/scripts/index.js',
        dest: 'build/scripts/bundle.js',
        options: {
          browserifyOptions: {
            debug:     DEV,
            transform: browserifyTransform
          }
        }
      },
      embed: {
        src: 'src/scripts/embed.js',
        dest: 'build/scripts/embed.js',
        options: {
          browserifyOptions: {
            debug:      DEV,
            transform:  browserifyTransform,
            standalone: 'Notebook'
          }
        }
      },
      test: {
        src: ['test/scripts/common.js', 'test/scripts/helpers.js'],
          dest: TEST_DIR + '/scripts/bundle.js',
        options: {
          browserifyOptions: {
            debug:     DEV,
            transform: browserifyTransform
          }
        }
      }
    }, browserifyPlugins),

    /**
     * Compile the CSS using the Stylus preprocessor.
     *
     * @type {Object}
     */
    stylus: {
      compile: {
        files: {
          'build/styles/main.css': 'src/styles/index.styl'
        },
        options: {
          'include css': true,
          import: ['nib']
        }
      }
    },

    /**
     * Start some simple servers using connect middleware.
     *
     * @type {Object}
     */
    connect: {
      server: {
        options: {
          middleware: serverMiddleware,
          port:       PORT,
          hostname:   'localhost',
          base:       BUILD_DIR
        }
      }
    },

    /**
     * Watch for changes on any specific files and rebuild the output.
     *
     * @type {Object}
     */
    watch: {
      html: {
        files: ['src/**/*.html'],
        tasks: ['newer:copy:build']
      },
      lint: {
        files: ['<%= jshint.all.src %>'],
        tasks: ['newer:jshint:all']
      },
      scripts: {
        files: ['src/**/*.{hbs,js}'],
        tasks: ['browserify']
      },
      styles: {
        files: ['src/**/*.styl'],
        tasks: ['stylus']
      }
    }
  });

  // Test the application in a headless browser environment.
  grunt.registerTask('test-browser', [
    'build', 'connect:server', 'shell:mocha-browser'
  ]);

  // Test the application in a headless environment.
  grunt.registerTask('test', [
    'check', 'test-browser'
  ]);

  // Generate the built application.
  grunt.registerTask('build', [
    'check', 'clean:build', 'copy:build', 'browserify', 'stylus'
  ]);

  grunt.registerTask('pages', [
    'shell:build-gh-pages', 'shell:gh-pages'
  ]);

  // Do a static check to make sure the code is correct.
  grunt.registerTask('check', [
    'jshint:all'
  ]);

  // Build the application and watch for file changes.
  grunt.registerTask('default', [
    'build', 'connect:server', 'watch'
  ]);
};
