module.exports = function(grunt) {
  'use strict';

  var gruntConfig = {
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      src: ['Gruntfile.js', 'videojs.vast.js'],
      test: ['spec/*.js']
    },
    karma: {
      unit: {
        configFile: 'karma.unit.conf.js',
        autoWatch: false,
        singleRun: true
      },
      e2e: {
        configFile: 'karma.e2e.conf.js',
        autoWatch: false,
        singleRun: true
      },
      dev: {
        configFile: 'karma.e2e.conf.js',
        autoWatch: true,
        singleRun: false
      }
    },
    coveralls: {
      options: {
        coverage_dir: './coverage',
        force: true,
        recursive: true
      }
    },
    connect: {
      server: {
        options: {
          keepalive: true
        }
      }
    },
    watch: {
      scripts: {
        files: ['*.js', 'spec/*.js'],
        tasks: ['jshint', 'jasmine']
      },
    },
    'curl-dir': {
      'spec-files': {
        src: [
          'http://techslides.com/demos/sample-videos/small.mp4',
          'http://techslides.com/demos/sample-videos/small.webm'
        ],
        dest: 'spec/files'
      }
    }
  };

  grunt.initConfig(gruntConfig);

  grunt.loadNpmTasks('grunt-env');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-curl');
  grunt.loadNpmTasks('grunt-karma-coveralls');
  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('default', ['jshint', 'curl-dir:spec-files', 'karma:unit']);
};
