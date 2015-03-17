(function(window, document, videojs, undefined) {
  'use strict';

  var
    _options,
    _player,
    _playerEl,
    _vpaid,
    _vpaidIFrame,
    _vpaidPlayer,
    _tracker,
    _skipBtn;

  var _setTrackerDuration = function() {
    if (_vpaid.getAdDuration) {
      var duration = _vpaid.getAdDuration();
      if (duration > 0) {
        _tracker.setDuration(duration);
      }
    }
  };

  var _onAdError = function() {
    _player.trigger('ended');
  };

  var _onAdLoaded = function() {
    _tracker = _player.vast.tracker();

    _vpaid.startAd();

    _setTrackerDuration();

    _player.trigger('ads-ready');
  };

  var _onAdStopped = function() {
    _player.removeClass('vjs-vpaidjs-started');

    _tracker = null;

    _player.trigger('ended');

    // HACK: Instead of unloading the tech, rewire all the events
    // when src() is called
    if (_player && _player['techName']) {
      _player['techName'] = null;
      _player.unloadTech();
    }
  };

  var _onAdDurationChange = function() {
    _setTrackerDuration();
  };

  var _onAdRemainingTimeChange = function() {
    _setTrackerDuration();
  };

  var _onAdSkipped = function() {
    _tracker.skip();
    _player.trigger('ended');
  };

  var _onAdStarted = function() {
    _tracker.load();
    _player.addClass('vjs-vpaidjs-started');
  };

  var _onAdVolumeChange = function() {
    _tracker.setMuted(_vpaid.getAdVolume() === 0);
    _player.setVolume(_vpaid.getAdVolume());
  };

  var _onAdImpression = function() {
    // TODO
  };

  var _onAdVideoStart = function() {
    _tracker.setProgress(0);

    if (!_player.paused()) {
      _player.pause();
    }
  };

  var _onAdVideoFirstQuartile = function() {
    var emulatedFirstQuartile = Math.round(25 * _vpaid.getAdDuration()) / 100;
    _tracker.setProgress(emulatedFirstQuartile);
  };

  var _onAdVideoMidpoint = function() {
    var emulatedMidpoint = Math.round(50 * _vpaid.getAdDuration()) / 100;
    _tracker.setProgress(emulatedMidpoint);
  };

  var _onAdVideoThirdQuartile = function() {
    var emulatedThirdQuartile = Math.round(75 * _vpaid.getAdDuration()) / 100;
    _tracker.setProgress(emulatedThirdQuartile);
  };

  var _onAdVideoComplete = function() {
    _tracker.setProgress(_vpaid.getAdDuration());
  };

  var _onAdClickThru = function(url, id, playerHandles) { // jshint ignore:line
    _tracker.click();
  };

  var _onAdUserAcceptInvitation = function() {
    _tracker.acceptInvitation();
  };

  var _onAdUserClose = function() {
    _tracker.close();
  };

  var _onAdPaused = function() {
    _tracker.setPaused(true);

    if (!_player.paused()) {
      _player.pause();
    }
  };

  var _onAdPlaying = function() {
    _tracker.setPaused(false);

    if (_player.paused()) {
      _player.play();
    }
  };

  var _onAdSkippableStateChange = function() {
    if (_vpaid.getAdSkippableState()) {
      // TODO: create skip button
    } else if (_skipBtn) {
      _skipBtn.parentNode.removeChild(_skipBtn);
    }
  };

  var _addVPAIDEvents = function() {
    _vpaid.subscribe(_onAdError, 'AdError');
    _vpaid.subscribe(_onAdLoaded, 'AdLoaded');
    _vpaid.subscribe(_onAdStopped, 'AdStopped');
    _vpaid.subscribe(_onAdDurationChange, 'AdDurationChange');
    _vpaid.subscribe(_onAdRemainingTimeChange, 'AdRemainingTimeChange');
    _vpaid.subscribe(_onAdSkipped, 'AdSkipped');
    _vpaid.subscribe(_onAdStarted, 'AdStarted');
    _vpaid.subscribe(_onAdVolumeChange, 'AdVolumeChange');
    _vpaid.subscribe(_onAdImpression, 'AdImpression');
    _vpaid.subscribe(_onAdVideoStart, 'AdVideoStart');
    _vpaid.subscribe(_onAdVideoFirstQuartile, 'AdVideoFirstQuartile');
    _vpaid.subscribe(_onAdVideoMidpoint, 'AdVideoMidpoint');
    _vpaid.subscribe(_onAdVideoThirdQuartile, 'AdVideoThirdQuartile');
    _vpaid.subscribe(_onAdVideoComplete, 'AdVideoComplete');
    _vpaid.subscribe(_onAdClickThru, 'AdClickThru');
    _vpaid.subscribe(_onAdUserAcceptInvitation, 'AdUserAcceptInvitation');
    _vpaid.subscribe(_onAdUserClose, 'AdUserClose');
    _vpaid.subscribe(_onAdPaused, 'AdPaused');
    _vpaid.subscribe(_onAdPlaying, 'AdPlaying');
    _vpaid.subscribe(_onAdSkippableStateChange, 'AdSkippableStateChange');
  };

  var _removeVPAIDEvents = function() {
    _vpaid.unsubscribe(_onAdError, 'AdError');
    _vpaid.unsubscribe(_onAdLoaded, 'AdLoaded');
    _vpaid.unsubscribe(_onAdStopped, 'AdStopped');
    _vpaid.unsubscribe(_onAdDurationChange, 'AdDurationChange');
    _vpaid.unsubscribe(_onAdRemainingTimeChange, 'AdRemainingTimeChange');
    _vpaid.unsubscribe(_onAdSkipped, 'AdSkipped');
    _vpaid.unsubscribe(_onAdStarted, 'AdStarted');
    _vpaid.unsubscribe(_onAdVolumeChange, 'AdVolumeChange');
    _vpaid.unsubscribe(_onAdImpression, 'AdImpression');
    _vpaid.unsubscribe(_onAdVideoStart, 'AdVideoStart');
    _vpaid.unsubscribe(_onAdVideoFirstQuartile, 'AdVideoFirstQuartile');
    _vpaid.unsubscribe(_onAdVideoMidpoint, 'AdVideoMidpoint');
    _vpaid.unsubscribe(_onAdVideoThirdQuartile, 'AdVideoThirdQuartile');
    _vpaid.unsubscribe(_onAdVideoComplete, 'AdVideoComplete');
    _vpaid.unsubscribe(_onAdClickThru, 'AdClickThru');
    _vpaid.unsubscribe(_onAdUserAcceptInvitation, 'AdUserAcceptInvitation');
    _vpaid.unsubscribe(_onAdUserClose, 'AdUserClose');
    _vpaid.unsubscribe(_onAdPaused, 'AdPaused');
    _vpaid.unsubscribe(_onAdPlaying, 'AdPlaying');
    _vpaid.unsubscribe(_onAdSkippableStateChange, 'AdSkippableStateChange');
  };

  var _addVPAIDContainer = function() {
    _vpaidIFrame = videojs.Component.prototype.createEl('iframe', {
      scrolling: 'no',
      marginWidth: 0,
      marginHeight: 0,
      frameBorder: 0,
      webkitAllowFullScreen: 'true',
      mozallowfullscreen: 'true',
      allowFullScreen: 'true'
    });

    _vpaidIFrame.onload = function() {
      // TODO: Enable this if VPAID no longer creates it's own player
      var iframeDoc = _vpaidIFrame.contentDocument;

      // Credos http://stackoverflow.com/a/950146/51966
      // Adding the script tag to the head as suggested before
      var head = iframeDoc.getElementsByTagName('head')[0];
      var script = iframeDoc.createElement('script');
      script.type = 'text/javascript';
      script.src = _player.currentSrc();

      // backwards-compatibility: https://msdn.microsoft.com/en-us/lirary/ie/hh180173%28v=vs.85%29.aspx
      if(script.addEventListener) {
        script.addEventListener("load", function() { _initVPAID(); });
      } else if (script.readyState) {
        script.onreadystatechange = function() { _initVPAID(); };
      } else {
        videojs.log.warn('no event listener function available');
      }

      head.appendChild(script);
    };

    document.body.appendChild(_vpaidIFrame);
  };

  var _removeVPAIDContainer = function() {
    _disposeVPAID();

    if (!_vpaidIFrame) {
      videojs.log.warn('no VPAID container defined');
      return;
    }

    document.body.removeChild(_vpaidIFrame);

    _vpaidIFrame = null;
  };

  var _addVPAIDPlayer = function() {
    // use existing HTML video tag if it's a mobile device
    if (/iphone|ipad|android/gi.test(navigator.userAgent)) {
      _vpaidPlayer = _playerEl.querySelector('video.vjs-tech');
    }

    if (_vpaidPlayer) {
      return;
    }

    _vpaidPlayer = videojs.Component.prototype.createEl('video', {
      id: _player.id() + '_vpaidjs_api',
      scrolling: 'no',
      marginWidth: 0,
      marginHeight: 0,
      frameBorder: 0,
      webkitAllowFullScreen: 'true',
      mozallowfullscreen: 'true',
      allowFullScreen: 'true'
    });

    videojs.insertFirst(_vpaidPlayer, _playerEl);
  };

  var _removeVPAIDPlayer = function() {
    if (!_vpaidPlayer) {
      videojs.log.warn('no VPAID tech defined');
      return;
    }

    // only remove the player if it was created by this tech
    if (_vpaidPlayer.id !== _player.id() + '_vpaidjs_api') {
      return;
    }

    _playerEl.removeChild(_vpaidPlayer);

    _vpaidPlayer = null;
  };

  var _initVPAID = function() {
    if (!_vpaidIFrame) {
      videojs.log.error('Vpaidjs', '_initVPAID', 'no VPAID iframe available');
      return;
    }

    if (_vpaidIFrame.contentWindow.getVPAIDAd === undefined) {
      return;
    }

    _vpaid = _vpaidIFrame.contentWindow.getVPAIDAd();

    if (_vpaid.handshakeVersion('2.0') !== '2.0') {
      throw new Error("Versions different to 2.0 are not supported");
    }

    _addVPAIDPlayer();

    var pref = {
      videoSlotCanAutoPlay: true,
      slot: _playerEl,
      videoSlot: _vpaidPlayer
    };

    // wire up to VPAID events
    _addVPAIDEvents();

    //TODO add creativeData
    _vpaid.initAd(_player.width(), _player.height(), _options.viewMode, _options.bitrate, {}, pref);
  };

  var _disposeVPAID = function() {
    _removeVPAIDEvents();
    _removeVPAIDPlayer();

    _vpaid = null;
  };

  videojs.Vpaidjs = videojs.Html5.extend({
    /** @constructor */
    init: function(player, options, ready) {
      // default values
      _options = videojs.util.mergeOptions({
        viewMode: 'normal',
        bitrate: 1000
      }, options);

      _player = player;
      _playerEl = player.el();

      _addVPAIDContainer();

      if (options.source) {
        this.ready(function() {
          this.src(options.source.src);
        });
      }

      videojs.MediaTechController.call(this, player, options, ready);

      this.triggerReady();
    }
  });

  videojs.Vpaidjs.prototype.dispose = function() {
    _removeVPAIDContainer();

    _options = null;
    _player = null;
    _playerEl = null;
    _tracker = null;

    videojs.MediaTechController.prototype.dispose.call(this);
  };

  videojs.Vpaidjs.canPlaySource = function(srcObj) {
    return srcObj.type === 'application/javascript' ? 'maybe' : '';
  };

  videojs.Vpaidjs.isSupported = function() {
    return true;
  };

})(window, document, videojs);
