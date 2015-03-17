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
        '-W069': false,
        globals: [
          'require',
          'module',
          'spyOn',
          'expect',
          'jasmine',
          'videojs',
          'DMVAST',
          'console',
          'Event',
          'CrossXHR',
          'vjs',
          'videojs']},
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
        singleRun: true,
        autoWatch: false,
        logLevel: 'ERROR',
        frameworks: ['mocha', 'sinon', 'chai'],
        files: [
          { pattern: 'test/vast/*', watched: true, served: true, included: false },
          { pattern: 'test/media/*', watched: true, served: true, included: false },
          { pattern: 'bower_components/crossxhr/crossxhr.swf', watched: false, served: true, included: false },

          'bower_components/crossxhr/crossxhr.js',
          'bower_components/vast-client-js/vast-client.js',
          'bower_components/video.js/dist/video-js/video.novtt.dev.js',
          'bower_components/videojs-contrib-ads/src/videojs.ads.css',
          'bower_components/videojs-contrib-ads/src/videojs.ads.js',
          'src/css/videojs.vast.css',
          'src/js/videojs.vast.js',
          'src/js/videojs.vpaidjs.js',
          'src/js/videojs.vpaidflash.js'],
        browsers: ['Chrome']
      },
      unit: {
        files: [
          { src: ['test/*.js'] }
        ]
      },
      dev: {
        singleRun: false,
        background: true,
        logLevel: 'INFO',
        files: [
          { src: ['test/*.js'] }
        ]
      }
    },
    connect: {
      server: {
        port: 9000,
        base: '.'
      }
    },
    watch: {
      js: {
        files: [
          'Gruntfile.js',
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
  grunt.registerTask('dev', ['karma:dev', 'watch']);
  grunt.registerTask('default', ['jshint', 'concat', 'uglify']);
};
