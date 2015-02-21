module.exports = function(config) {
  config.set({
    frameworks: ['jasmine'],
    browsers: ['Chrome'],

    basePath: '',

    files: [
      'bower_components/vast-client-js/vast-client.js',
      'bower_components/videojs/dist/video-js/video.dev.js',
      'bower_components/videojs-contrib-ads/src/videojs.ads.js',
      'videojs.vast.js',
      'spec/*.spec.e2e.js',

      // Feed fixtures
      { pattern: 'spec/*.xml', watched: true, served:  true, included: false },

      { pattern: 'spec/files/*', watched: true, served:  true, included: false }
    ],

    preprocessors: {
      'videojs.vast.js': 'coverage',
      'spec/*.xml': []
    },

    reporters: ['progress', 'coverage'],

    coverageReporter: {
      type: 'lcov',
      dir: 'coverage/'
    },

    plugins: [
      'karma-jasmine',
      'karma-coverage',
      'karma-chrome-launcher',
      'karma-phantomjs-launcher'
    ]
  });
};