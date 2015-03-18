module.exports = function(grunt) {
  'use strict';

  var gruntConfig = {
    info: grunt.file.readJSON('bower.json'),
    meta: {
      banner: '/*!\n'+
              ' * <%= info.name %> - <%= info.description %>\n'+
              ' * v<%= info.version %>\n'+
              ' * <%= info.homepage %>\n'+
              ' * copyright <%= info.copyright %> <%= grunt.template.today("yyyy") %>\n'+
              ' * <%= info.license %> License\n'+
              '*/\n'
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      src: [
        'Gruntfile.js',
        'src/js/*.js'],
      test: [
        'test/*.js'
      ]
    },
    concat: {
      options: {
        banner: '<%= meta.banner %>'
      },
      dist: {
        src: 'src/js/*.js',
        dest: 'dist/videojs.vast.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= meta.banner %>'
      },
      dist: {
        src: 'dist/videojs.vast.js',
        dest: 'dist/videojs.vast.min.js'
      }
    },
    karma: {
      options: {
        configFile: 'karma.conf.js'
      },
      ci: {
        configFile: 'karma.ci.conf.js'
      },
      unit: {
      },
      dev: {
        browsers: ['Chrome'],
        singleRun: false,
        background: true
      }
    },
    connect: {
      server: {
        port: 9000,
        base: '.'
      }
    },
    watch: {
      karma: {
        options: {
          reload: true
        },
        files: [
          'Gruntfile.js',
          'karma.conf.js',
          'src/js/*.js',
          'test/*.js',
          '.jshintrc'
        ],
        tasks: ['jshint', 'karma:dev:run']
      }
    },
    'curl-dir': {
      'test-media-files': {
        src: [
          'http://techslides.com/demos/sample-videos/small.flv',
          'http://techslides.com/demos/sample-videos/small.mp4',
          'http://techslides.com/demos/sample-videos/small.webm'
        ],
        dest: 'test/media'
      }
    }
  };

  require('load-grunt-tasks')(grunt);

  grunt.initConfig(gruntConfig);

  grunt.registerTask('curl-test-files', ['curl-dir:test-media-files']);
  grunt.registerTask('test', ['jshint', 'karma:unit']);
  grunt.registerTask('dev', ['karma:dev:start', 'watch']);
  grunt.registerTask('ci', ['jshint', 'karma:ci']);
  grunt.registerTask('default', ['jshint', 'concat', 'uglify']);
};
