var DEV        = process.env.NODE_ENV !== 'production';
var PLUGIN_DIR = __dirname + '/public/scripts/plugins/addons';
var TEST_PORT  = 9876;

module.exports = function (grunt) {
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  var browserifyPlugins   = {};
  var browserifyTransform = ['envify', 'brfs'];

  if (!DEV) {
    browserifyTransform.push('uglifyify');
  }

  require('fs').readdirSync(PLUGIN_DIR).forEach(function (filename) {
    // Remove trailing extension and transform to camelCase
    var baseName = grunt.util._.camelize(filename.replace(/\.js$/, ''));

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
    clean: ['build/'],

    copy: {
      build: {
        files: [
          { expand: true, cwd: 'public', src: ['**/*.html'], dest: 'build/' }
        ]
      }
    },

    connect: {
      'test-server': {
        options: {
          port: TEST_PORT,
          base: 'build'
        }
      }
    },

    shell: {
      'mocha-phantomjs': {
        command: './node_modules/.bin/mocha-phantomjs ./test/index.html',
        options: {
          stdout: true,
          stderr: true,
          failOnError: true
        }
      },
      'jshint': {
        command: './node_modules/.bin/jshint public/scripts routes app.js',
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
          shim: {
            'backbone.native': {
              path: __dirname + '/vendor/backbone.native.js',
              exports: 'Backbone',
              depends: {
                'backbone': 'Backbone'
              }
            }
          },
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
      scripts: {
        files: ['public/**/*.{js,hbs}'],
        tasks: ['browserify'],
        options: {
          livereload: true
        }
      },
      styles: {
        files: ['public/**/*.styl'],
        tasks: ['stylus'],
        options: {
          livereload: true
        }
      }
    }
  });

  grunt.registerTask('test-notebook', function () {
    process.env.NOTEBOOK_URL = 'http://localhost:' + TEST_PORT;
  });

  grunt.registerTask(
    'headless-test',
    ['test-notebook', 'build', 'connect:test-server', 'shell:mocha-phantomjs']
  );

  grunt.registerTask('build',   ['clean', 'copy', 'browserify', 'stylus']);
  grunt.registerTask('check',   ['shell:jshint', 'headless-test']);
  grunt.registerTask('default', ['build', 'watch']);
};
