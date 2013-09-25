var DEV         = process.env.NODE_ENV !== 'production';
var PLUGIN_DIR  = __dirname + '/public/scripts/plugins/addons';
var BUILD_DIR   = __dirname + '/build';
var DEPLOY_DIR  = __dirname + '/deploy';
var TESTS_DIR   = __dirname + '/build/test';
var FIXTURE_DIR = TESTS_DIR + '/fixtures';
var TEST_PORT   = 9876;
var jsRegex     = /\.js$/;

module.exports = function (grunt) {
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  var browserifyPlugins   = {};
  var browserifyTransform = ['envify', 'brfs'];

  if (!DEV) {
    browserifyTransform.push('uglifyify');
  }

  require('fs').readdirSync(PLUGIN_DIR).forEach(function (filename) {
    if (!jsRegex.test(filename)) { return; }
    // Remove trailing extension and transform to camelCase
    var baseName = grunt.util._.camelize(filename.replace(jsRegex, ''));

    browserifyPlugins[baseName] = {
      src:  PLUGIN_DIR + '/' + filename,
      dest: 'build/plugins/' + filename,
      options: {
        transform:  browserifyTransform,
        standalone: baseName + 'Plugin'
      }
    };
  });

  grunt.initConfig({
    clean: {
      build: BUILD_DIR,
      deploy: DEPLOY_DIR
    },

    copy: {
      build: {
        files: [
          {
            expand: true,
            cwd: 'public',
            src: ['**/*.{html,yml}'],
            dest: 'build/'
          },
          { src: 'public/test.js', dest: FIXTURE_DIR + '/test.js' }
        ]
      },
      deploy: {
        files: [
          { src: '{build,routes}/**/*', dest: 'deploy/' },
          { src: '{app.js,Procfile,package.json}', dest: 'deploy/' },
          {
            src: 'node_modules/{raml-parser,raml-examples}/**/*',
            dest: DEPLOY_DIR + '/'
          }
        ]
      }
    },

    connect: {
      'test-server': {
        options: {
          middleware: function (connect, options) {
            var middlewares = [];
            // Enables cross-domain requests.
            middlewares.push(function (req, res, next) {
              res.setHeader('Access-Control-Allow-Origin',  '*');
              res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
              return next();
            });
            // Serve the regular static directory.
            middlewares.push(connect.static(options.base));
            return middlewares;
          },
          port: TEST_PORT,
          base: BUILD_DIR
        }
      }
    },

    jshint: {
      all: {
        src: ['routes/**/*.js', 'public/**/*.js', '*.js']
      },
      options: {
        jshintrc: '.jshintrc'
      }
    },

    shell: {
      'mocha-browser': {
        command: './node_modules/.bin/mocha-phantomjs test/browser/index.html',
        options: {
          stdout: true,
          stderr: true,
          failOnError: true
        }
      },
      'mocha-server': {
        command: './node_modules/.bin/mocha test/server/spec',
        options: {
          stdout: true,
          stderr: true,
          failOnError: true
        }
      },
      'build-heroku': {
        command: [
          'HEROKU_ENDPOINT=`git config --get remote.heroku.url`',
          'HEROKU_APP=`echo $HEROKU_ENDPOINT | ' +
            'sed -E "s/^git@heroku.com:(.+).git/\\1/"`',
          'HEROKU_URL="http://$HEROKU_APP.herokuapp.com"',
          'NODE_ENV="production" NOTEBOOK_URL=$HEROKU_URL ' +
            'GITHUB_CLIENT_ID=$DEPLOY_GITHUB_CLIENT_ID grunt build'
        ].join('; '),
        options: {
          stdout: true,
          stderr: true,
          failOnError: true
        }
      },
      'deploy-heroku': {
        command: [
          'HEROKU_ENDPOINT=`git config --get remote.heroku.url`',
          'cd deploy',
          'git init .',
          'git add . > /dev/null',
          'git commit -m "Deploy" > /dev/null',
          'git push $HEROKU_ENDPOINT master:master -f'
        ].join(' && '),
        options: {
          stdout: true,
          stderr: true,
          failOnError: true
        }
      }
    },

    browserify: grunt.util._.extend({
      application: {
        src: 'public/scripts/index.js',
        dest: 'build/scripts/bundle.js',
        options: {
          debug:     DEV,
          transform: browserifyTransform
        }
      },
      embed: {
        src: 'public/scripts/embed.js',
        dest: 'build/scripts/embed.js',
        options: {
          transform:  browserifyTransform,
          standalone: 'Notebook'
        }
      },
      test: {
        src: 'test/browser/common.js',
        dest: TESTS_DIR + '/browser/common.js',
        options: {
          transform: browserifyTransform
        }
      }
    }, browserifyPlugins),

    stylus: {
      compile: {
        files: {
          'build/styles/main.css': 'public/styles/index.styl'
        },
        options: {
          'include css': true,
          import: [
            'includes/colors.styl'
          ]
        }
      }
    },

    watch: {
      html: {
        files: ['public/**/*.{html,yml}'],
        tasks: ['newer:copy:build']
      },
      lint: {
        files: ['<%= jshint.all.src %>'],
        tasks: ['newer:jshint:all']
      },
      scripts: {
        files: ['public/**/*.js'],
        tasks: ['browserify']
      },
      styles: {
        files: ['public/**/*.styl'],
        tasks: ['stylus']
      }
    }
  });

  // Update the deploy dependencies list.
  grunt.registerTask('deploy-bundle-dependencies', function () {
    var pkg = grunt.file.readJSON(DEPLOY_DIR + '/package.json');
    pkg.bundledDependencies = require('fs').readdirSync(
      DEPLOY_DIR + '/node_modules'
    );
    grunt.file.write(
      DEPLOY_DIR + '/package.json', JSON.stringify(pkg, undefined, 2)
    );
  });

  // Set the notebook test url.
  grunt.registerTask('test-notebook-url', function () {
    process.env.NOTEBOOK_URL = 'http://localhost:' + TEST_PORT;
  });

  // Test the server-side of the application.
  grunt.registerTask('test-server', [
    'shell:mocha-server'
  ]);

  // Test the application in a headless browser environment.
  grunt.registerTask('test-browser', [
    'test-notebook-url', 'build', 'connect:test-server', 'shell:mocha-browser'
  ]);

  // Test the application in a headless environment.
  grunt.registerTask('test', [
    'check', 'test-browser', 'test-server'
  ]);

  // Deploy the application to heroku.
  grunt.registerTask('deploy', [
    'clean:deploy', 'shell:build-heroku', 'copy:deploy',
    'deploy-bundle-dependencies', 'shell:deploy-heroku', 'clean:deploy'
  ]);

  // Generate the built application.
  grunt.registerTask('build', [
    'clean:build', 'copy:build', 'browserify', 'stylus'
  ]);

  // Do a static check to make sure the code is correct.
  grunt.registerTask('check', [
    'jshint:all'
  ]);

  // Build the application and watch for file changes.
  grunt.registerTask('default', [
    'build', 'watch'
  ]);
};
