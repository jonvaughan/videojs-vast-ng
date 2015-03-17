/*!
 * videojs-vast-ng - A VAST plugin for VideoJS
 * v0.1.0
 * https://github.com/pragmaticlabs/videojs-vast-ng
 * copyright  2015
 * MIT License
*/
(function(window, videojs, CrossXHR, undefined) {
  'use strict';
  var _parseXml;

  if (window.DOMParser) {
    _parseXml = function(xmlStr) {
      return ( new window.DOMParser() ).parseFromString(xmlStr, 'text/xml');
    };
  } else if (typeof window.ActiveXObject !== 'undefined' && new window.ActiveXObject('Microsoft.XMLDOM')) {
    _parseXml = function(xmlStr) {
      var xmlDoc = new window.ActiveXObject('Microsoft.XMLDOM');
      xmlDoc.async = 'false';
      xmlDoc.loadXML(xmlStr);
      return xmlDoc;
    };
  } else {
    _parseXml = function() { return null; };
  }

  // custom url handler for requesting VAST tags to bypass CORS problems
  var SwfURLHandler = function(options) {
    return {
      supported: function() {
        return CrossXHR && videojs.Flash.isSupported();
      },

      get: function(url, options, cb) {
        try {
          var xhr = new CrossXHR();
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              var xml = _parseXml(xhr.responseText);
              if (options.debug) { videojs.log('vast', 'vast response', xml); }
              cb(null, xml);
            }
          };
          if (options.debug) { videojs.log('request to ', url); }
          xhr.open('GET', url);
          xhr.send();
        } catch(e) {
          videojs.log.warn(e);
          cb();
        }
      }
    };
  };
})(window, videojs, CrossXHR);
(function(window, videojs, dmvast, CrossXHR, undefined) {
  'use strict';

  var _parseXml;

  if (window.DOMParser) {
    _parseXml = function(xmlStr) {
      return ( new window.DOMParser() ).parseFromString(xmlStr, 'text/xml');
    };
  } else if (typeof window.ActiveXObject !== 'undefined' && new window.ActiveXObject('Microsoft.XMLDOM')) {
    _parseXml = function(xmlStr) {
      var xmlDoc = new window.ActiveXObject('Microsoft.XMLDOM');
      xmlDoc.async = 'false';
      xmlDoc.loadXML(xmlStr);
      return xmlDoc;
    };
  } else {
    _parseXml = function() { return null; };
  }

  // custom url handler for requesting VAST tags to bypass CORS problems
  var swfURLHandler = {
    supported: function() {
      return CrossXHR && videojs.Flash.isSupported();
    },

    get: function(url, options, cb) {
      try {
        var xhr = new CrossXHR();
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            var xml = _parseXml(xhr.responseText);
            if (options.debug) { videojs.log('vast', 'vast response', xml); }
            cb(null, xml);
          }
        };
        if (options.debug) { videojs.log('request to ', url); }
        xhr.open('GET', url);
        xhr.send();
      } catch(e) {
        videojs.log.warn(e);
        cb();
      }
    }
  };

  function vast(options) {
    var
      _player = this, // jshint ignore:line
      _playerEl = _player.el(),
      _showContentControls,
      _sources,
      _companions,
      _tracker,
      _adbreak,
      _skipBtn;

    _player.vast = _player.vast || {};

    var _createSourceObjects = function(mediaFiles) {
      var sourcesByFormat = {}, i, j, t, techName, tech, sbf, techOrder = _player.options().techOrder;

      for (i = 0; i < techOrder.length; i++) {
        t = techOrder[i];
        techName = t.charAt(0).toUpperCase() + t.slice(1);
        tech = window.videojs[techName];
        sbf = sourcesByFormat[t] = [];

        // Check if the current tech is defined before continuing
        if (!tech) {
          videojs.log.warn('vast', 'createSourceObjects', 'skipping "' + techName + '"; tech not found');
          continue;
        }

        // Check if the browser supports this technology
        if (!tech.isSupported()) {
          videojs.log.warn('vast', 'createSourceObjects', 'skipping "' + techName + '"; tech not supported');
          continue;
        }

        // Loop through each source object
        for (j = 0; j < mediaFiles.length; j++) {
          var f = mediaFiles[j];

          var source = {
            type: f.mimeType,
            src: f.fileURL,
            width: f.width,
            height: f.height,

            // extended properties
            apiFramework: f.apiFramework,
            adParameters: f.adParameters,
            duration: f.duration,
            bitrate: f.bitrate
          };

          // Check if source can be played with this technology
          if (!tech.canPlaySource(source)) {
            continue;
          }

          sbf.push(source);
        }
      }

      // Create sources in preferred format order
      var sources = [];

      for (i = 0; i < techOrder.length; i++) {
        tech = techOrder[i];

        if (sourcesByFormat[tech] === undefined) {
          if (options.debug) { videojs.log('vast', 'createSourceObjects', 'no sources found for tech:', tech); }
          continue;
        }

        for (j = 0; j < sourcesByFormat[tech].length; j++) {
          sources.push(sourcesByFormat[tech][j]);
        }
      }

      return sources;
    };

    var _sourceContainsVPAID = function(sources) {
      if (!sources) {
        return false;
      }

      for(var i=0; i<sources.length; i++) {
        if (sources[i].apiFramework === 'VPAID') {
          return true;
        }
      }

      return false;
    };

    var _setupTrackerEvents = function() {
      var
        errorOccurred = false,
        t = _tracker,
        canplayFn = function(e) {
          if (options.debug) { videojs.log('vast', 'event', 'canplay'); }
          _tracker.load();
        },
        timeupdateFn = function() {
          if (isNaN(t.assetDuration)) {
            t.assetDuration = _player.duration();
          }
          t.setProgress(_player.currentTime());
        },
        pauseFn = function(e) {
          if (options.debug) { videojs.log('vast', 'event', 'pause'); }
          t.setPaused(true);
          _player.one('play', function() {
            if (options.debug) { videojs.log('vast', 'event', 'pauseFn', 'play'); }
            t.setPaused(false);
          });
        },
        errorFn = function(e) {
          videojs.log.error('vast', 'event', 'error', e);
          // Inform ad server we couldn't play the media file for this ad
          dmvast.util.track(t.ad.errorURLTemplates, {ERRORCODE: 405});
          errorOccurred = true;
          _player.trigger('ended');
        };

      _player.on('canplay', canplayFn);
      _player.on('timeupdate', timeupdateFn);
      _player.on('pause', pauseFn);
      _player.on('error', errorFn);

      _player.one('adend', function() {
        _player.off('canplay', canplayFn);
        _player.off('timeupdate', timeupdateFn);
        _player.off('pause', pauseFn);
        _player.off('error', errorFn);

        if (!errorOccurred) {
          t.complete();
        }
      });
    };

    var _adClick = function() {
      if (options.debug) { videojs.log('vast', 'clicked'); }

      var clickthrough;

      if (_tracker.clickThroughURLTemplate) {
        clickthrough = dmvast.util.resolveURLTemplates(
          [_tracker.clickThroughURLTemplate],
          {
            CACHEBUSTER: Math.round(Math.random() * 1.0e+10),
            CONTENTPLAYHEAD: _tracker.progressFormated()
          }
        )[0];
      }

      if (!clickthrough) {
        return;
      }

      if (_player.paused()) {
        _player.play();
        return false;
      }

      if (_tracker.clickTrackingURLTemplate) {
        _tracker.trackURLs([_tracker.clickTrackingURLTemplate]);
      }

      _player.trigger('adclick');

      window.open(clickthrough, '_blank');
      _player.pause();
    };

    var _addSkipBtn = function() {
      // add skip button
      if (options.skip < 0) {
        if (options.debug) { videojs.log('vast', 'init ui', 'skip < 0, disabling skip button'); }
        return;
      }

      if (_skipBtn) {
        videojs.log.warn('vast', 'init ui', 'skip button already exists. removing it first');
        _removeSkipBtn();
      }

      _skipBtn = videojs.Component.prototype.createEl('div', {
        className: 'vast-skip-button',
        onclick: function(e) {
          if((' ' + _skipBtn.className + ' ').indexOf(' enabled ') >= 0) {
            _tracker.skip();
            _endAd();
          }
          if(window.Event.prototype.stopPropagation !== undefined) {
            e.stopPropagation();
          } else {
            return false;
          }
        }
      });

      videojs.insertFirst(_skipBtn, _playerEl);

      _player.on('timeupdate', _updateSkipBtn);
    };

    var _removeSkipBtn = function() {
      // remove skip button
      if (!_skipBtn || !_skipBtn.parentNode) {
        if (options.debug) { videojs.log('vast', 'remove', 'no skip button found:', _skipBtn); }
        return;
      }

      _skipBtn.parentNode.removeChild(_skipBtn);
      _skipBtn = null;

      _player.off('timeupdate', _updateSkipBtn);
    };

    var _updateSkipBtn = function() {
      if (!_skipBtn) {
        _removeSkipBtn();
        return;
      }

      var timeLeft = Math.ceil(options.skip - _player.currentTime());

      if(timeLeft > 0) {
        _skipBtn.innerHTML = 'AD#' + _adbreak.count + '/' + options.maxAdCount + ' Skip in ' + timeLeft + '...';
      } else {
        if((' ' + _skipBtn.className + ' ').indexOf(' enabled ') === -1) {
          _skipBtn.className += ' enabled';
          _skipBtn.innerHTML = 'AD#' + _adbreak.count + '/' + options.maxAdCount + ' Skip';
        }
      }
    };

    var _updateCompanions = function() {
      for(var i=0; i<_companions.variations.length; i++) {
        var comp = _companions.variations[i];
        var q = '#' + _player.id() + '-' + comp.width + 'x' + comp.height;
        var compEl = document.querySelector(q);

        if (!compEl) {
          if (options.debug) { videojs.log('no companion element found:', q); }
          continue;
        }

        if (comp.staticResource) {
          var img = new Image();
          img.src = comp.staticResource;
          img.width = comp.width;
          img.height = comp.height;

          var aEl = document.createElement('a');
          aEl.setAttribute('target', '_blank');
          aEl.href = comp.companionClickThroughURLTemplate;
          aEl.appendChild(img);

          compEl.innerHTML = '';
          compEl.appendChild(aEl);
        } else if (comp.htmlResource) {
          compEl.innerHTML = comp.htmlResource;
        } else if (comp.iframeResource) {
          var iframeEl = videojs.Component.prototype.createEl('iframe', {
            scrolling: 'no',
            marginWidth: 0,
            marginHeight: 0,
            frameBorder: 0,
            src: comp.iframeResource
          });

          compEl.appendChild(iframeEl);
        } else {
          if (options.debug) { videojs.log('vast', 'ignoring companion: ', comp); }
        }
      }
    };

    var _startLinearAdBreak = function() {
      if (options.debug) { videojs.log('vast', 'startLinearAdBreak'); }

      _player.ads.startLinearAdMode();
      _showContentControls = _player.controls();

      // save state of player controls so we can restore them after the ad break
      if (_showContentControls) {
        _player.controls(false);
      }
    };

    var _endLinearAdBreak = function() {
      if (options.debug) { videojs.log('vast', 'endLinearAdBreak'); }

      // restore state of player controls before the ad break
      if (_showContentControls) {
        if (options.debug) { videojs.log('vast', 'unloadAd', 'enable controls'); }
        _player.controls(true);
      }

      _player.ads.endLinearAdMode();

      _adbreak = null;

      _player.play();
    };

    var _endAd = function(forceEndAdBreak) {
      if (options.debug) { videojs.log('vast', 'endAd', _player.ads.state); }

      _player.off('ended', _endAd);

      if (!_adbreak) {
        videojs.log.warn('vast', 'endAd', 'not playing an AD! state: ' + _player.ads.state);
        return;
      } else {
        videojs.log('adbreak', _adbreak);
      }

      _player.off('click', _adClick);
      _removeSkipBtn();

      // Decide if we want to call another AD to simulate VAST 3 AD Pods
      if (forceEndAdBreak === true || _adbreak.attempts >= options.maxAdAttempts || _adbreak.count >= options.maxAdCount) {
        _endLinearAdBreak();
      } else {
        _loadVAST();
      }
    };

    var _startAd = function() {
      if (options.debug) { videojs.log('vast', 'startAd', _player.ads.state); }

      if (_player.ads.state !== 'ad-playback') {
        _startLinearAdBreak();
      }

      _adbreak.count++;

      // HACK: Instead of unloading the tech, rewire all the events
      // when src() is called
      if (_player['techName'] === 'Vpaidflash' && _player.ended()) {
        _player['techName'] = null;
      }

      // load linear ad sources and start playing them
      _player.src(_sources);

      if (_tracker && !_sourceContainsVPAID(_sources)) {
        _player.on('click', _adClick);
        _addSkipBtn();
      }

      if (_companions) {
        _updateCompanions();
      }

      _setupTrackerEvents();

      _player.on('ended', _endAd);

      _player.play();
    };

    var _loadVAST = function() {
      if (options.debug) { videojs.log('vast', 'loadVAST'); }

      _adbreak.attempts++;

      if (!options.url) {
        _player.trigger('adscanceled');
        return;
      }

      dmvast.client.get(options.url, { urlhandler: options.customURLHandler }, function(response) {
        if (options.debug) { videojs.log('vast', 'loadVAST', 'response', response); }

        if (response) {
          // TODO: Rework code to support VAST 3 AD Pods

          // we got a response, deal with it
          for (var i = 0; i < response.ads.length; i++) {
            var ad = response.ads[i];
            var foundCreative = false, foundCompanion = false;
            for (var j = 0; j < ad.creatives.length && (!foundCreative || !foundCompanion); j++) {
              var creative = ad.creatives[j];

              switch(creative.type) {
                case 'linear':

                  if (foundCreative) {
                    videojs.log.warn('vast', 'loadVAST', 'ignoring linear; already found one');
                    continue;
                  }

                  if (!creative.mediaFiles.length) {
                    videojs.log.warn('vast', 'loadVAST', 'ignoring linear; no media files found');
                    continue;
                  }

                  var sources = _createSourceObjects(creative.mediaFiles);

                  if (sources && sources.length) {
                    _sources = sources;
                    foundCreative = true;

                    _tracker = new dmvast.tracker(ad, creative);
                  }

                  break;

                case 'companion':

                  if (foundCompanion) {
                    videojs.log.warn('vast', 'loadVAST', 'ignoring companion; already found one');
                    continue;
                  }

                  _companions = creative;

                  foundCompanion = true;

                  break;

                default:

                  videojs.log.warn('vast', 'loadVAST', 'unknown creative found:', creative);
              }
            }

            if (foundCreative) {
              if (options.debug) { videojs.log('vast', 'loadVAST', 'found VAST'); }

              // vast tracker and content is ready to go, trigger event
              _startAd();
              return;
            }

            _sources = undefined;
            _companions = undefined;

            // inform ad server we can't find suitable media file for this ad
            dmvast.util.track(ad.errorURLTemplates, {ERRORCODE: 403});
          }
        }

        // no ads found: lets cancel the ad break
        _player.trigger('adscanceled');
      });
    };

    var _unloadVAST = function() {
      if (options.debug) { videojs.log('vast', 'unloadAd'); }

      _endAd();

      _sources = null;
      _companions = null;
      _tracker = null;
    };

    _player.vast.preroll = function() {

      // reset these values on every ad break to support multiple
      // ads per ad break
      _adbreak = {
        attempts: 0,
        count: 0
      };

      _loadVAST();
    };

    _player.vast.midroll = function() {
      throw new Error('midroll not implemented');
    };

    _player.vast.postroll = function() {
      throw new Error('postroll not implemented');
    };

    _player.vast.ensureLeaveAdBreak = function() {
      _endAd(true);
      _unloadVAST();
    };

    _player.vast.tracker = function() {
      return _tracker;
    };

    _player.vast.skip = function(skip) {
      if (skip === undefined) {
        return options.skip;
      } else {
        options.skip = skip;
      }
    };

    _player.vast.url = function(url) {
      if (url === undefined) {
        return options.url;
      } else {
        options.url = url;
      }
    };

    _player.vast.maxAdCount = function(maxAdCount) {
      if (maxAdCount === undefined) {
        return options.maxAdCount;
      } else {
        options.maxAdCount = maxAdCount;
      }
    };

    _player.vast.maxAdAttempts = function(maxAdAttempts) {
      if (maxAdAttempts === undefined) {
        return options.maxAdAttempts;
      } else {
        options.maxAdAttempts = maxAdAttempts;
      }
    };

    _player.vast.currentAdAttempt = function() {
      return _adbreak ? _adbreak.attempts : undefined;
    };

    _player.vast.currentAdCount = function() {
      return _adbreak ? _adbreak.count : undefined;
    };

    // check that we have the ads plugin
    if (_player.ads === undefined) {
      videojs.log.error('vast', 'vast video plugin requires videojs-contrib-ads, vast plugin not initialized');
      return null;
    }

    _player.on('contentupdate', function(e) {
      if (options.debug) { videojs.log('vast', 'contentupdate', e.newValue); }
      _player.trigger('adsready');
    });

    _player.on('readyforpreroll', function() {
      if (options.debug) { videojs.log('vast', 'readyforpreroll'); }

      // set up and start playing preroll
      _player.vast.preroll();
    });

    // merge in default values
    options = videojs.util.mergeOptions({
      debug: false,
      skip: 5,
      customURLHandler: swfURLHandler,
      maxAdAttempts: 1,
      maxAdCount: 1,
      adParameters: {}
    }, options);
  }

  videojs.plugin('vast', vast);

}(window, videojs, DMVAST, CrossXHR));

/**
 * @fileoverview VideoJS-SWF - Custom Flash Player with HTML5-ish API
 * https://github.com/zencoder/video-js-swf
 * Not using setupTriggers. Using global onEvent func to distribute events
 */

/**
 * VPAID Flash Media Controller - Wrapper for fallback SWF API
 *
 * @param {vjs.Player} player
 * @param {Object=} options
 * @param {Function=} ready
 * @constructor
 */
vjs.Vpaidflash = vjs.MediaTechController.extend({
  /** @constructor */
  init: function(player, options, ready){
    vjs.MediaTechController.call(this, player, options, ready);

    var source = options['source'],

        // Generate ID for swf object
        objId = player.id()+'_vpaidflash_api',

        // Store player options in local var for optimization
        // TODO: switch to using player methods instead of options
        // e.g. player.autoplay();
        playerOptions = player.options_,

        // Merge default flashvars with ones passed in to init
        flashVars = vjs.obj.merge({

          // SWF Callback Functions
          'readyFunction': 'vjs.Vpaidflash.onReady',
          'eventProxyFunction': 'vjs.Vpaidflash.onEvent',
          'errorEventProxyFunction': 'vjs.Vpaidflash.onError',

          // Player Settings
          'autoplay': playerOptions.autoplay,
          'preload': playerOptions.preload,
          'loop': playerOptions.loop,
          'muted': playerOptions.muted

        }, options['flashVars']),

        // Merge default parames with ones passed in
        params = vjs.obj.merge({
          'wmode': 'opaque', // Opaque is needed to overlay controls, but can affect playback performance
          'bgcolor': '#000000' // Using bgcolor prevents a white flash when the object is loading
        }, options['params']),

        // Merge default attributes with ones passed in
        attributes = vjs.obj.merge({
          'id': objId,
          'name': objId, // Both ID and Name needed or swf to identify itself
          'class': 'vjs-tech'
        }, options['attributes'])
    ;

    // If source was supplied pass as a flash var.
    if (source) {
      this.ready(function(){
        this.setSource(source);
      });
    }

    // Add placeholder to player div
    vjs.insertFirst(this.el_, options['parentEl']);

    // Having issues with Flash reloading on certain page actions (hide/resize/fullscreen) in certain browsers
    // This allows resetting the playhead when we catch the reload
    if (options['startTime']) {
      this.ready(function(){
        this.load();
        this.play();
        this['currentTime'](options['startTime']);
      });
    }

    // firefox doesn't bubble mousemove events to parent. videojs/video-js-swf#37
    // bugzilla bug: https://bugzilla.mozilla.org/show_bug.cgi?id=836786
    if (vjs.IS_FIREFOX) {
      this.ready(function(){
        this.on('mousemove', function(){
          // since it's a custom event, don't bubble higher than the player
          this.player().trigger({ 'type':'mousemove', 'bubbles': false });
        });
      });
    }

    // native click events on the SWF aren't triggered on IE11, Win8.1RT
    // use stageclick events triggered from inside the SWF instead
    player.on('stageclick', player.reportUserActivity);

    this.el_ = vjs.Flash.embed(options['swf'], this.el_, flashVars, params, attributes);
  }
});

vjs.Vpaidflash.prototype.dispose = function(){
  vjs.MediaTechController.prototype.dispose.call(this);
};

vjs.Vpaidflash.prototype.play = function(){
  this.el_.vjs_play();
};

vjs.Vpaidflash.prototype.pause = function(){
  this.el_.vjs_pause();
};

vjs.Vpaidflash.prototype.src = function(src){
  if (src === undefined) {
    return this['currentSrc']();
  }

  // Setting src through `src` not `setSrc` will be deprecated
  return this.setSrc(src);
};

vjs.Vpaidflash.prototype.setSrc = function(src){

  // Patch taken from https://github.com/guardian/video.js/blob/master/src/js/media/vpaid.js#L115
  // A dependency on the vast plugin. Retrieve the source object for the requested src,
  // and pass properties into the player.
  if (this.player_.vast && this.player_.vast.sources) {

    var sources = this.player_.vast.sources();

    var sourceObject;

    vjs.arr.forEach(sources, function(srcObj) {
      if (srcObj.src === src) {
        sourceObject = srcObj;
      }
    }, this);

    if (sourceObject) {
      this.el_.vjs_setProperty('adParameters', sourceObject['adParameters']);
      this.el_.vjs_setProperty('duration', sourceObject['duration']);
      this.el_.vjs_setProperty('bitrate', sourceObject['bitrate']);
      this.el_.vjs_setProperty('width', sourceObject['width']);
      this.el_.vjs_setProperty('height', sourceObject['height']);

      this.player_.duration(sourceObject['duration']);
      this['trackCurrentTime']();
    }
  }

  // Make sure source URL is absolute.
  src = vjs.getAbsoluteURL(src);
  this.el_.vjs_src(src);

  // Currently the SWF doesn't autoplay if you load a source later.
  // e.g. Load player w/ no source, wait 2s, set src.
  if (this.player_.autoplay()) {
    var tech = this;
    this.setTimeout(function(){ tech.play(); }, 0);
  }
};

vjs.Vpaidflash.prototype['setCurrentTime'] = function(time){
  this.lastSeekTarget_ = time;
  this.el_.vjs_setProperty('currentTime', time);
  vjs.MediaTechController.prototype.setCurrentTime.call(this);
};

vjs.Vpaidflash.prototype['currentTime'] = function (time) { // jshint ignore:line
  // when seeking make the reported time keep up with the requested time
  // by reading the time we're seeking to
  if (this.seeking()) {
    return this.lastSeekTarget_ || 0;
  }
  return this.el_.vjs_getProperty('currentTime');
};

vjs.Vpaidflash.prototype['currentSrc'] = function(){
  if (this.currentSource_) {
    return this.currentSource_.src;
  } else {
    return this.el_.vjs_getProperty('currentSrc');
  }
};

vjs.Vpaidflash.prototype.load = function(){
  this.el_.vjs_load();
};

vjs.Vpaidflash.prototype.poster = function(){
  this.el_.vjs_getProperty('poster');
};
vjs.Vpaidflash.prototype['setPoster'] = function(){
  // poster images are not handled by the Flash tech so make this a no-op
};

vjs.Vpaidflash.prototype.buffered = function(){
  return vjs.createTimeRange(0, this.el_.vjs_getProperty('buffered'));
};

vjs.Vpaidflash.prototype.supportsFullScreen = function(){
  return false; // Flash does not allow fullscreen through javascript
};

vjs.Vpaidflash.prototype.enterFullScreen = function(){
  return false;
};

(function () {
  // Create setters and getters for attributes
  var api = vjs.Vpaidflash.prototype,
    readWrite = 'preload,defaultPlaybackRate,playbackRate,autoplay,loop,mediaGroup,controller,controls,volume,muted,defaultMuted'.split(','),
    readOnly = 'error,networkState,readyState,seeking,initialTime,duration,startOffsetTime,paused,played,seekable,ended,videoTracks,audioTracks,width,height'.split(','),
    // Overridden: buffered, currentTime, currentSrc
    i;

  function createSetter(attr){
    var attrUpper = attr.charAt(0).toUpperCase() + attr.slice(1);
    api['set'+attrUpper] = function(val){ return this.el_.vjs_setProperty(attr, val); };
  }
  function createGetter(attr) {
    api[attr] = function(){ return this.el_.vjs_getProperty(attr); };
  }

  // Create getter and setters for all read/write attributes
  for (i = 0; i < readWrite.length; i++) {
    createGetter(readWrite[i]);
    createSetter(readWrite[i]);
  }

  // Create getters for read-only attributes
  for (i = 0; i < readOnly.length; i++) {
    createGetter(readOnly[i]);
  }
})();

/* Flash Support Testing -------------------------------------------------------- */

vjs.Vpaidflash.isSupported = function(){
  return vjs.Vpaidflash.version()[0] >= 10;
  // return swfobject.hasFlashPlayerVersion('10');
};

// Add Source Handler pattern functions to this tech
vjs.MediaTechController.withSourceHandlers(vjs.Vpaidflash);

/**
 * The default native source handler.
 * This simply passes the source to the video element. Nothing fancy.
 * @param  {Object} source   The source object
 * @param  {vjs.Vpaidflash} tech  The instance of the Flash tech
 */
vjs.Vpaidflash.nativeSourceHandler = {};

/**
 * Check Flash can handle the source natively
 * @param  {Object} source  The source object
 * @return {String}         'probably', 'maybe', or '' (empty string)
 */
vjs.Vpaidflash.nativeSourceHandler.canHandleSource = function(source){
  var type;

  if (!source.type) {
    return '';
  }

  // Strip code information from the type because we don't get that specific
  type = source.type.replace(/;.*/,'').toLowerCase();

  if (type in vjs.Vpaidflash.formats) {
    return 'maybe';
  }

  return '';
};

/**
 * Pass the source to the flash object
 * Adaptive source handlers will have more complicated workflows before passing
 * video data to the video element
 * @param  {Object} source    The source object
 * @param  {vjs.Vpaidflash} tech   The instance of the Flash tech
 */
vjs.Vpaidflash.nativeSourceHandler.handleSource = function(source, tech){
  tech.setSrc(source.src);
};

/**
 * Clean up the source handler when disposing the player or switching sources..
 * (no cleanup is needed when supporting the format natively)
 */
vjs.Vpaidflash.nativeSourceHandler.dispose = function(){};

// Register the native source handler
vjs.Vpaidflash.registerSourceHandler(vjs.Vpaidflash.nativeSourceHandler);

vjs.Vpaidflash.formats = {
  'application/x-shockwave-flash': 'SWF'
};

vjs.Vpaidflash['onReady'] = function(currSwf){
  var el, player;

  el = vjs.el(currSwf);

  // get player from the player div property
  player = el && el.parentNode && el.parentNode['player'];

  // if there is no el or player then the tech has been disposed
  // and the tech element was removed from the player div
  if (player) {
    // reference player on tech element
    el['player'] = player;
    // check that the flash object is really ready
    vjs.Vpaidflash['checkReady'](player.tech);
  }
};

// The SWF isn't always ready when it says it is. Sometimes the API functions still need to be added to the object.
// If it's not ready, we set a timeout to check again shortly.
vjs.Vpaidflash['checkReady'] = function(tech){
  // stop worrying if the tech has been disposed
  if (!tech.el()) {
    return;
  }

  // check if API property exists
  if (tech.el().vjs_getProperty) {
    // tell tech it's ready
    tech.triggerReady();
  } else {
    // wait longer
    this.setTimeout(function(){
      vjs.Vpaidflash['checkReady'](tech);
    }, 50);
  }
};

// Trigger events from the swf on the player
vjs.Vpaidflash['onEvent'] = function(swfID, eventName){
  var player = vjs.el(swfID)['player'];
  player.trigger(eventName);
};

// Log errors from the swf
vjs.Vpaidflash['onError'] = function(swfID, err){
  var player = vjs.el(swfID)['player'];
  var msg = 'FLASH: '+err;

  if (err == 'srcnotfound') { // jshint ignore:line
    player.error({ code: 4, message: msg });

  // errors we haven't categorized into the media errors
  } else {
    player.error(msg);
  }
};

// Flash Version Check
vjs.Vpaidflash.version = function(){
  var version = '0,0,0';

  // IE
  try {
    version = new window.ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version').replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];

  // other browsers
  } catch(e) {
    try {
      if (navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin){
        version = (navigator.plugins['Shockwave Flash 2.0'] || navigator.plugins['Shockwave Flash']).description.replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];
      }
    } catch(err) {}
  }
  return version.split(',');
};

// Flash embedding method. Only used in non-iframe mode
vjs.Vpaidflash.embed = function(swf, placeHolder, flashVars, params, attributes){
  var code = vjs.Vpaidflash.getEmbedCode(swf, flashVars, params, attributes),

      // Get element by embedding code and retrieving created element
      obj = vjs.createEl('div', { innerHTML: code }).childNodes[0],

      par = placeHolder.parentNode
  ;

  placeHolder.parentNode.replaceChild(obj, placeHolder);
  obj[vjs.expando] = placeHolder[vjs.expando];

  // IE6 seems to have an issue where it won't initialize the swf object after injecting it.
  // This is a dumb fix
  var newObj = par.childNodes[0];
  setTimeout(function(){
    newObj.style.display = 'block';
  }, 1000);

  return obj;

};

vjs.Vpaidflash.getEmbedCode = function(swf, flashVars, params, attributes){

  var objTag = '<object type="application/x-shockwave-flash" ',
      flashVarsString = '',
      paramsString = '',
      attrsString = '';

  // Convert flash vars to string
  if (flashVars) {
    vjs.obj.each(flashVars, function(key, val){
      flashVarsString += (key + '=' + val + '&amp;');
    });
  }

  // Add swf, flashVars, and other default params
  params = vjs.obj.merge({
    'movie': swf,
    'flashvars': flashVarsString,
    'allowScriptAccess': 'always', // Required to talk to swf
    'allowNetworking': 'all' // All should be default, but having security issues.
  }, params);

  // Create param tags string
  vjs.obj.each(params, function(key, val){
    paramsString += '<param name="'+key+'" value="'+val+'" />';
  });

  attributes = vjs.obj.merge({
    // Add swf to attributes (need both for IE and Others to work)
    'data': swf,

    // Default to 100% width/height
    'width': '100%',
    'height': '100%'

  }, attributes);

  // Create Attributes string
  vjs.obj.each(attributes, function(key, val){
    attrsString += (key + '="' + val + '" ');
  });

  return objTag + attrsString + '>' + paramsString + '</object>';
};
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
