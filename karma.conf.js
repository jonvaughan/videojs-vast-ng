module.exports = function(config) {
  config.set({
    singleRun: false,
    autoWatch: false,
    logLevel: config.LOG_DEBUG,
    frameworks: ['mocha', 'sinon-chai', 'requirejs'],
    browsers: ['Chrome'],
    port: 9876,

    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,

    // to avoid DISCONNECTED messages
    browserDisconnectTimeout : 10000, // default 2000
    browserDisconnectTolerance : 1, // default 0
    browserNoActivityTimeout : 60000, //default 10000

    files: [
      { pattern: 'test/vast/*', included: false },
      { pattern: 'test/img/*', included: false },
      { pattern: 'test/media/*', included: false },
      { pattern: 'bower_components/crossxhr/crossxhr.swf', watched: false, included: false },
      'bower_components/crossxhr/crossxhr.js',
      'bower_components/vast-client-js/vast-client.js',
      'bower_components/video.js/dist/video-js/video.novtt.dev.js',
      'bower_components/videojs-contrib-ads/src/videojs.ads.css',
      'bower_components/videojs-contrib-ads/src/videojs.ads.js',
      'src/js/util.js',
      'src/js/vpaidjs.js',
      'src/js/vpaidflash.js',
      'src/js/swfurlhandler.js',
      'src/js/videojs.vast.js',
      'src/css/videojs.vast.css',
      'test/*.test.js'],

    preprocessors: {
      'src/js/*.js': 'coverage'
    },

    reporters: ['mocha', 'coverage'],

    coverageReporter: {
      type : 'html',
      dir : 'coverage/'
    }
  });
};