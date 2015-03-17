module.exports = function(config) {
  config.set({
    singleRun: true,
    autoWatch: false,
    logLevel: 'ERROR',
    browsers: ['PhantomJS'],
    frameworks: ['mocha', 'sinon', 'chai'],
    browsers: ['Chrome'],

    files: [
      { pattern: 'test/vast/*', watched: true, served: true, included: false },
      { pattern: 'test/media/*', watched: true, served: true, included: false },
      { pattern: 'bower_components/crossxhr/crossxhr.swf', watched: false, served: true, included: false },
      'bower_components/crossxhr/crossxhr.js',
      'bower_components/vast-client-js/vast-client.js',
      'bower_components/video.js/dist/video-js/video.novtt.dev.js',
      'bower_components/videojs-contrib-ads/src/videojs.ads.css',
      'bower_components/videojs-contrib-ads/src/videojs.ads.js',
      'src/js/crossxhr.js',
      'src/js/vpaidjs.js',
      'src/js/vpaidflash.js',
      'src/js/swfurlhandler.js',
      'src/js/videojs.vast.js',
      'src/css/videojs.vast.css',
      { pattern: 'test/*.js', watched: true, served: true, included: true }],

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