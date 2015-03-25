module.exports = function(config) {
  // support for saucelabs
  if (!process.env.SAUCE_USERNAME || !process.env.SAUCE_ACCESS_KEY) {
    console.log('Make sure the SAUCE_USERNAME and SAUCE_ACCESS_KEY environment variables are set.');
    process.exit(1);
  }

  // Browsers to run on Sauce Labs
  // Check out https://saucelabs.com/platforms for all browser/OS combos
  var customLaunchers = {
    'SL_Chrome': {
      base: 'SauceLabs',
      platform: 'linux',
      browserName: 'chrome'
    },
    'SL_Firefox': {
      base: 'SauceLabs',
      platform: 'linux',
      browserName: 'firefox'
    },
    'SL_IE_11': {
      base: 'SauceLabs',
      browserName: 'internet explorer',
      platform: 'Windows 8.1',
      version: '11'
    },
    'SL_IE_10': {
      base: 'SauceLabs',
      browserName: 'internet explorer',
      platform: 'Windows 7',
      version: '10'
    },
    'SL_IE_9': {
      base: 'SauceLabs',
      browserName: 'internet explorer',
      platform: 'Windows 7',
      version: '9'
    }
  };

  config.set({
    singleRun: true,
    autoWatch: false,
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
      'src/js/util.js',
      'src/js/crossxhr.js',
      'src/js/vpaidjs.js',
      'src/js/vpaidflash.js',
      'src/js/swfurlhandler.js',
      'src/js/videojs.vast.js',
      'src/css/videojs.vast.css',
      { pattern: 'test/*.js', watched: true, served: true, included: true }],

    sauceLabs: {
      testName: 'videojs-vast-ng',
      recordScreenshots: false,
      connectOptions: {
        port: 5757,
        logfile: 'sauce_connect.log'
      }
    },
    basePath: '',
    port: 9876,
    logLevel: config.LOG_DEBUG,
    reporters: ['mocha', 'saucelabs'],
    captureTimeout: 120000,
    customLaunchers: customLaunchers,
    browsers: Object.keys(customLaunchers)
  });
};