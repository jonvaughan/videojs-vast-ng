(function(factory){
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define('videojs-vast-ng', ['videojs', 'vast-client-js'], function(vjs){factory(window, document, vjs, dmvast);});
  } else if (typeof exports === 'object' && typeof module === 'object') {
    factory(window, document, require('video.js'), require('vast-client-js'));
  } else {
    factory(window, document, videojs, DMVAST);
  }
})

(function(window, document, videojs, dmvast, undefined) {
  'use strict';

  // function stacktrace() {
  //     var err = new Error();
  //     return err.stack;
  // }

  var vastFactory = function(player, options) {
    // merge in default values
    options = videojs.util.mergeOptions({
      debug: false,
      skip: 5,
      vastURLHandler: null,
      maxAdAttempts: 1,
      maxAdCount: 1,
      vastTimeout: 5000,
      adResponseHandler: null,
      adTagUrlHandler: null,
      companionPrefix: player.id() + '-companion-' // jshint ignore:line
    }, options);

    if (isNaN(options.maxAdAttempts)) {
      throw 'vast plugin init error: invalid maxAdAttempts value \'' + options.maxAdAttempts + '\'';
    }

    if (isNaN(options.maxAdCount)) {
      throw 'vast plugin init error: invalid maxAdCount value \'' + options.maxAdCount + '\'';
    }

    var vast = {};

    var
      playerEl = player.el(),
      _showContentControls,
      _sources,
      _companions,
      _tracker,
      _adbreak,
      _skipBtn,
      _vastRequestCount = 0;

    var _createSourceObjects = function(mediaFiles, adParameters) {
      var sourcesByFormat = {}, i, j, to, techName, tech, sbf, techOrder = player.options().techOrder;

      for (i = 0; i < techOrder.length; i++) {
        to = techOrder[i];
        techName = to.charAt(0).toUpperCase() + to.slice(1);
        tech = window.videojs[techName];
        sbf = sourcesByFormat[to] = [];

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
            adParameters: adParameters,
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

    var richTracker = function(tracker) {
      var
        errorOccurred = false,
        canplayFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'adcanplay'); }
          tracker.load();
        },
        durationchangeFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'addurationchange'); }
          tracker.assetDuration = player.duration();
        },
        timeupdateFn = function() {
          var t = player.currentTime();
          tracker.setProgress(t);
        },
        playFn = function() {
          if (options.debug) { videojs.log('vast', 'tracker', 'adplay'); }
          tracker.setPaused(false);
        },
        pauseFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'adpause'); }
          tracker.setPaused(true);
        },
        errorFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'vasterror', e); }
          // Inform ad server we couldn't play the media file for this ad
          dmvast.util.track(tracker.ad.errorURLTemplates, {ERRORCODE: 405});
          errorOccurred = true;
          vast.retryAdAttempt(false);
        },
        endedFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'adended'); }

          if (!errorOccurred) {
            tracker.complete();
          }
        },
        timeoutFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'vasttimeout', e); }
          // Inform ad server we couldn't play the media file for this ad
          dmvast.util.track(tracker.ad.errorURLTemplates, {ERRORCODE: 402});
          errorOccurred = true;
          vast.retryAdAttempt(false);
        },
        creativeviewFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'creativeView'); }

          tracker.track('creativeView');
        },
        startFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'start'); }

          tracker.track('start');
        },
        firstquartileFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'firstQuartile'); }

          tracker.track('firstQuartile');
        },
        midpointFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'midpoint'); }

          tracker.track('midpoint');
        },
        thirdquartileFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'thirdQuartile'); }

          tracker.track('thirdQuartile');
        },
        clicktrackingFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'clickthrough'); }

          tracker.click();
        },
        acceptinvitationFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'acceptInvitation'); }

          tracker.track('acceptInvitation');
        },
        collapseFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'collapse'); }

          tracker.track('collapse');
        },
        skipFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'skip'); }

          // TODO: Refactor/merge code from _skipBtn.onclick
          tracker.skip();
          _endAd(false, true);
        },
        closeFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'close'); }

          tracker.track('close');
        },
        muteFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'mute'); }

          tracker.setMuted(true);
        },
        unmuteFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'unmute'); }

          tracker.setMuted(false);
        };

      tracker.initListeners = function() {
        if (options.debug) { videojs.log('vast', 'tracker', 'initListeners'); }
        player.on(['vastimpression', 'adcanplay'], canplayFn);
        player.on('addurationchange', durationchangeFn);
        player.on('adtimeupdate', timeupdateFn);
        player.on(['vastresume', 'adplay'], playFn);
        player.on(['vastpause', 'adpause'], pauseFn);
        player.on('adended', endedFn);
        player.on(['vasterror', 'aderror'], errorFn);
        player.on('vasttimeout', timeoutFn);

        // Listen for VAST events
        player.on('vastcreativeview', creativeviewFn);
        player.on('vaststart', startFn);
        player.on('vastfirstquartile', firstquartileFn);
        player.on('vastmidpoint', midpointFn);
        player.on('vastthirdquartile', thirdquartileFn);

        player.on(['adclick', 'vastclicktracking'], clicktrackingFn);
        player.on('vastacceptinvitation', acceptinvitationFn);
        player.on('vastcollapse', collapseFn);
        player.on('vastskip', skipFn);
        player.on('vastclose', closeFn);

        player.on(['admute', 'vastmute'], muteFn);
        player.on(['adunmute', 'vastunmute'], unmuteFn);
      };

      tracker.destroyListeners = function() {
        if (options.debug) { videojs.log('vast', 'tracker', 'destroyListeners'); }
        player.off(['vastimpression', 'adcanplay'], canplayFn);
        player.off('addurationchange', durationchangeFn);
        player.off('adtimeupdate', timeupdateFn);
        player.off(['vastresume', 'adplay'], playFn);
        player.off(['vastpause', 'adpause'], pauseFn);
        player.off('adended', endedFn);
        player.off(['vasterror', 'aderror'], errorFn);
        player.off('vasttimeout', timeoutFn);

        // Listen for VAST events
        player.off('vastcreativeview', creativeviewFn);
        player.off('vaststart', startFn);
        player.off('vastfirstquartile', firstquartileFn);
        player.off('vastmidpoint', midpointFn);
        player.off('vastthirdquartile', thirdquartileFn);

        player.off('vastclicktracking', clicktrackingFn);
        player.off('vastacceptinvitation', acceptinvitationFn);
        player.off('vastcollapse', collapseFn);
        player.off('vastskip', skipFn);
        player.off('vastclose', closeFn);

        player.off('vastmute', muteFn);
        player.off('vastunmute', unmuteFn);
      };

      return tracker;
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

      if (player.paused()) {
        player.play();
        return false;
      }

      if (_tracker.clickTrackingURLTemplate) {
        _tracker.trackURLs([_tracker.clickTrackingURLTemplate]);
      }

      player.trigger('adclick');

      window.open(clickthrough, '_blank');
      player.pause();
    };

    var _addSkipBtn = function() {
      // add skip button
      if (options.skip < 0) {
        if (options.debug) { videojs.log('vast', 'addSkipBtn', 'skip < 0, disabling skip button'); }
        return;
      }

      if (_skipBtn) {
        videojs.log.error('vast', 'addSkipBtn', 'skip button already exists. removing it first');
        _removeSkipBtn();
      }

      _skipBtn = videojs.Component.prototype.createEl('div', {
        className: 'vast-skip-button',
        onclick: function(e) {
          if(!_skipBtn.disabled && _skipBtn.className.indexOf(' enabled') !== -1) {
            if (options.debug) { videojs.log('vast', 'skipBtn clicked'); }
            _tracker.skip();
            _endAd(false, true);
            player.trigger('adskipped');
          }

          if(window.Event.prototype.stopPropagation !== undefined) {
            e.stopPropagation();
          } else {
            return false;
          }
        },
        disabled: true
      });

      videojs.insertFirst(_skipBtn, playerEl);

      player.on('adtimeupdate', _updateSkipBtn);
    };

    var _removeSkipBtn = function() {
      // remove skip button
      if (!_skipBtn || !_skipBtn.parentNode) {
        if (options.debug) { videojs.log('vast', 'remove', 'no skip button found:', _skipBtn); }
        return;
      }

      _skipBtn.parentNode.removeChild(_skipBtn);
      _skipBtn = null;

      player.off('adtimeupdate', _updateSkipBtn);
    };

    var _updateSkipBtn = function() {
      // if (options.debug) { videojs.log('vast', 'updateSkipBtn', player.ads.state); }

      if (!_skipBtn) {
        _removeSkipBtn();
        return;
      }

      var timeLeft = Math.ceil(options.skip - player.currentTime());

      if(timeLeft > 0) {
        // determine if we should should the skip button
        if(_skipBtn.className.indexOf(' enabled') === -1) {
          _skipBtn.className += ' enabled';
        }

        _skipBtn.innerHTML = 'Skip AD in ' + timeLeft + ' seconds';
      } else {
        _skipBtn.innerHTML = 'Skip >';
        _skipBtn.disabled = false;
      }
    };

    var _updateCompanions = function() {
      for(var i=0; i<_companions.variations.length; i++) {
        var comp = _companions.variations[i];
        var q = '#' + options.companionPrefix + comp.width + 'x' + comp.height;
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
      if (options.debug) { videojs.log('vast', 'starting linear ad break', player.ads.state); }

      player.ads.startLinearAdMode();

      if (_showContentControls === undefined) {
        _showContentControls = player.controls();
      }

      // save state of player controls so we can restore them after the ad break
      if (_showContentControls) {
        player.controls(false);
      }
    };

    var _endLinearAdBreak = function() {
      if (options.debug) { videojs.log('vast', 'ending linear ad break', player.ads.state); }

      // restore state of player controls before the ad break
      if (_showContentControls) {
        player.controls(true);
        _showContentControls = undefined;
      }

      player.ads.endLinearAdMode();

      _adbreak = null;

      // vjs.log('vast', 'endLinearAdBreak', 'muted=' + player.muted() + ' volume=' + player.volume());

      player.play();
    };

    var _endAd = function(forceEndAdBreak, triggerAdLeaveEvent) {
      if (options.debug) { videojs.log('vast', 'endAd', player.ads.state); }

      player.off('adended', _endAd);

      // if (!_adbreak) {
      //   videojs.log.warn('vast', 'endAd', 'not playing an AD! state: ' + player.ads.state);
      //   return;
      // } else {
      //   if (options.debug) { videojs.log('vast', 'endAd', 'adbreak: ', _adbreak); }
      // }

      player.off('click', _adClick);
      _removeSkipBtn();

      _unloadVAST();

      // Decide if we want to call another AD to simulate VAST 3 AD Pods
      if (forceEndAdBreak === true ||
        _adbreak.attempts >= options.maxAdAttempts ||
        _adbreak.count >= options.maxAdCount) {

        if (triggerAdLeaveEvent) {
          switch(player.ads.state) {
            case 'content-set':
            case 'ads-ready?':
              player.trigger('adscanceled');
              break;
            default:
              player.trigger('adserror');
              break;
          }
        }

        var a = vast.currentAdAttempt();
        var ma = vast.maxAdAttempts();
        var c = vast.currentAdCount();
        var mc = vast.maxAdCount();
        if (options.debug) { videojs.log('vast', 'endAd', 'state: ', player.ads.state, 'force end adbreak: ', forceEndAdBreak, 'exhaused attempts: ' + a + '/' + ma, ', count: ' + c + '/' + mc); }

        _endLinearAdBreak();
      } else {
        _loadVAST(true);
      }
    };

    var _startAd = function() {
      if (options.debug) { videojs.log('vast', 'startAd', player.ads.state, player.techName); }

      if (player.ads.state !== 'ad-playback') {
        _startLinearAdBreak();
      }

      _adbreak.count++;

      // vjs.log('vast', 'startAd', 'muted=' + player.muted() + ' volume=' + player.volume());

      // HACK: Force the tech to be reloaded after the ad finishes
      if (player.techName === 'Vpaidflash' && player.ended()) {
        if (options.debug) { videojs.log.warn('vast', 'startAd', 'Forcing Vpaidflash to be reloaded'); }
        player.techName = null;
      }

      // load linear ad sources and start playing them
      player.src(_sources);

      // VPAID will handle it's own click events.
      // TODO: make the vast plugin handle it
      if (_tracker && player.techName.indexOf('Vpaid') !== 0) {
        player.on('click', _adClick);
        _addSkipBtn();
      }

      if (options.debug) { videojs.log('vast', 'using tech: ' + player.techName, player.ads.state); }

      if (_companions) {
        _updateCompanions();
      }

      player.on('adended', _endAd);

      // HACK occassionally the loading wheel gets stuck on the screen
      if (player.hasClass('vjs-seeking')) {
        if (options.debug) { videojs.log.warn('force remove css vjs-seeking class'); }
        player.removeClass('vjs-seeking');
      }
      player.play();
    };

    vast.defaultAdResponseHandler = function(immediatePlayback, response, parentURLs) {
      if (!response) {
        // no valid response found so exit from ad break
        // player.trigger('adscanceled');
        vast.retryAdAttempt(false);
        return;
      }

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

              var sources = _createSourceObjects(creative.mediaFiles, creative.adParameters);

              if (sources && sources.length) {
                _sources = sources;
                foundCreative = true;

                // HACK: Guard against previous tracker still
                // listening to player events
                if (_tracker) {
                  videojs.log.warn('vast', 'loadVAST', 'Previous tracker not unloaded; unloading now!');

                  _tracker.destroyListeners();
                }

                _tracker = richTracker(new dmvast.tracker(ad, creative));
                _tracker.initListeners();
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

          if (immediatePlayback) {
            if (options.debug) { videojs.log.warn('vast', 'loadVAST', 'immediate AD playback!'); }
            setTimeout(_startAd, 1);
          } else {
            // vast tracker and content is ready to go, trigger event
            player.trigger('adsready');
          }
          return;
        }

        _sources = undefined;
        _companions = undefined;

        // inform ad server we can't find suitable media file for this ad
        dmvast.util.track(ad.errorURLTemplates, {ERRORCODE: 403});
      }

      // no ads found: lets cancel the ad break
      player.trigger('adscanceled');
    };

    var _loadVAST = function(immediatePlayback) {
      if (options.debug) { videojs.log('vast', 'loadVAST'); }

      _adbreak.attempts++;

      if (!options.url) {
        player.trigger('adscanceled');
        return;
      }

      if (_adbreak.requestId >= 1) {
        if (options.debug) { videojs.log.error('vast', 'loadVAST', 'ignore load vast request as another vast request (' + _adbreak.requestId + ') is in flight!'); }
        return;
      }

      _vastRequestCount++;

      var vastRequestId = _vastRequestCount;

      _adbreak.requestId = vastRequestId;

      if (options.debug && options.vastURLHandler) {
        videojs.log('vast', 'loadVAST', 'custom URLHandler provided: supported=' + options.vastURLHandler.supported());
      }

      var getOptions = {
        // withCredentials: true,
        urlhandler: options.vastURLHandler,
        timeout: options.vastTimeout
      };

      var url = options.url;

      if (options.adTagUrlHandler) {
        url = options.adTagUrlHandler(url);
      }

      if (options.debug) {
        videojs.log('vast', 'loadVAST', 'ad requested (' + vastRequestId + '): ' + url);
      }

      dmvast.client.get(url, getOptions, function(response, parentURLs) {
        var a = vast.currentAdAttempt();
        var ma = vast.maxAdAttempts();
        var c = vast.currentAdCount();
        var mc = vast.maxAdCount();
        if (options.debug) { videojs.log('vast', 'loadVAST', 'response (' + vastRequestId + ')', response, parentURLs, 'attempts: ' + a + '/' + ma, ', count: ' + c + '/' + mc); }

        if (!_adbreak || (_adbreak.requestId !== null && vastRequestId !== _adbreak.requestId)) {
          if (options.debug) { videojs.log.error('vast', 'loadVAST', 'ignore response (' + vastRequestId + ') as another vast request (' + (_adbreak ? _adbreak.requestId : null) + ') is in flight!'); }
          return;
        }

        _adbreak.requestId = null;

        var cb = options.adResponseHandler || vast.defaultAdResponseHandler;

        // handle ad response
        cb(immediatePlayback, response, parentURLs);
      });

      player.trigger('vastrequesting');
    };

    var _unloadVAST = function() {
      if (options.debug) { videojs.log('vast', 'unloadVAST'); }

      _sources = null;
      _companions = null;

      if (_tracker) {
        _tracker.destroyListeners();
      }

      _tracker = null;

      if (!_adbreak) {
        videojs.log.error('vast', 'unloadVAST', 'assertion: adbreak should be set!');
      }
    };

    vast.requestAdBreak = function(e) {
      if (options.debug) { videojs.log('vast', 'requestAdBreak', player.ads.state, e.type); }

      if (player.ads.state === 'content-set') {
        if (options.debug) {
          videojs.log('vast', 'requestAdBreak', 'ignored trigger by \'' +
          e.type + '\', ads state: ' + player.ads.state);
        }
        player.trigger('play');
        return;
      }

      if (player.ads.state !== 'ads-ready?' && e.type === 'play') {
        if (options.debug) {
          videojs.log('vast', 'requestAdBreak', 'ignored trigger by \'' +
          e.type + '\', ads state: ' + player.ads.state);
        }
        return;
      }

      _adbreak = {
        attempts: 0,
        count: 0,
        requestId: null
      };

      if (options.url) {
        _loadVAST();
      } else {
        if (options.debug) { videojs.log('vast', 'requestAdBreak', 'canceling ad break: no AD url present'); }
        player.trigger('adscanceled');
      }
    };

    vast.ensureLeaveAdBreak = function(triggerAdLeaveEvent) {
      if (options.debug) { videojs.log('vast', 'ensureLeaveAdBreak'); }

      _endAd(true, triggerAdLeaveEvent);
    };

    vast.adTagUrlHandler = function(handler) {
      if (handler === undefined) {
        return options.adTagUrlHandler;
      } else {
        options.adTagUrlHandler = handler;
      }
    };

    vast.retryAdAttempt = function(forceEndAdBreak) {
      _endAd(forceEndAdBreak, true);
    };

    vast.adResponseHandler = function(handler) {
      if (handler === undefined) {
        return options.adResponseHandler;
      } else {
        options.adResponseHandler = handler;
      }
    };

    vast.vastURLHandler = function(vastURLHandler) {
      if (vastURLHandler === undefined) {
        return options.vastURLHandler;
      } else {
        options.vastURLHandler = vastURLHandler;
      }
    };

    vast.tracker = function() {
      return _tracker;
    };

    vast.skip = function(skip) {
      if (skip === undefined) {
        return options.skip;
      } else {
        options.skip = skip;
      }
    };

    vast.url = function(url) {
      if (url === undefined) {
        return options.url;
      } else {
        options.url = url;
      }
    };

    vast.maxAdCount = function(maxAdCount) {
      if (maxAdCount === undefined) {
        return options.maxAdCount;
      } else {
        options.maxAdCount = maxAdCount;
      }
    };

    vast.maxAdAttempts = function(maxAdAttempts) {
      if (maxAdAttempts === undefined) {
        return options.maxAdAttempts;
      } else {
        options.maxAdAttempts = maxAdAttempts;
      }
    };

    vast.currentAdAttempt = function() {
      return _adbreak ? _adbreak.attempts : undefined;
    };

    vast.currentAdCount = function() {
      return _adbreak ? _adbreak.count : undefined;
    };

    vast.companionPrefix = function(companionPrefix) {
      if (companionPrefix === undefined) {
        return options.companionPrefix;
      } else {
        options.companionPrefix = companionPrefix;
      }
    };

    // check that we have the ads plugin
    if (player.ads === undefined) {
      videojs.log.error('vast', 'vast video plugin requires videojs-contrib-ads, vast plugin not initialized');
      return null;
    }

    player.on('adloadstart', function(e) {
      if (options.debug) { videojs.log('vast', 'adloadstart', player.ads.state); }
    });

    player.on('contentupdate', function(e) {
      if (options.debug) { videojs.log('vast', 'contentupdate', 'ads.state: ' +
        player.ads.state + ', newValue: ' + e.newValue); }

      // HACK: Chrome will sometimes fire contentupdate twice. Most browsers will have
      // e.newValue starting with 'http://...', but Chrome will sometimes fire two contentupdate
      // events from with e.newValue of 'ocean.mp4' and 'http://localhost:9000/ocean.mp4'.
      // This is not an issue if the src paths are absolute paths.
      // if (e.newValue && e.newValue.indexOf('http') !== 0) {
      //   videojs.log.warn('VAST-NG: duplicate contentupdate! \'' + e.oldValue + '\' to \'' + e.newValue + '\'');
      //   return;
      // }

      if (!player.paused()) {
        vast.requestAdBreak(e);
      }
    });

    // integration with videojs-playlist
    player.on(['next', 'previous', 'jump'], function(e) {
      if (options.debug) { videojs.log('vast', e.type, player.ads.state); }

      // HACK: If the ads state is 'ad-playback', then it means the 'next'
      // event was firing while an existing AD was playing. We have to force
      // the player to leave the running AD break so we can initialize
      // another one.
      if (player.ads.state === 'ad-playback') {
        vast.ensureLeaveAdBreak(true);
      }
    });

    player.on('contentended', function(e) {
      if (options.debug) { videojs.log('vast', 'contentended'); }

      if (player.ads.state === 'postroll?') {
        // TODO: postroll
      }
    });

    player.on('play', function(e) {
      if (options.debug) { videojs.log('vast', 'play', player.ads.state, e.type, player.ads.triggerevent.type); }

      // videojs.log('vast', 'play', 'tech=' + player.techName + ' muted=' + player.muted() + ' volume=' + player.volume());

      if (_adbreak) {
        if (options.debug) { videojs.log.warn('vast', 'play', 'ignored: ad break already going running', _adbreak); }
        return;
      }

      if (player.ads.state === 'ads-ready?') {
        vast.requestAdBreak(e);
      }
    });

    player.on('pause', function(e) {
      if (options.debug) { videojs.log('vast', 'pause'); }
    });

    player.on('contentplayback', function(e) {
      if (options.debug) { videojs.log('vast', 'contentplayback', e.triggerevent); }

      // vjs.log('vast', 'startAd', 'muted=' + player.muted() + ' volume=' + player.volume());
    });

    player.on('contentpause', function(e) {
      if (options.debug) { videojs.log('vast', 'contentpause', e.triggerevent); }
    });

    player.on('readyforpreroll', function() {
      if (options.debug) { videojs.log('vast', 'readyforpreroll'); }

      if (!_adbreak ||
        isNaN(options.maxAdAttempts) ||
        isNaN(options.maxAdCount)) {
        if (options.debug) { videojs.log.error('vast', 'readyforpreroll', 'no ad break found'); }
        player.trigger('adserror');
        return;
      }

      _startAd();
    });

    player.on(['adtimeout', 'adscanceled', 'adserror'], function(e) {
      if (options.debug) { videojs.log.warn(e.type + ' triggered'); }
      vast.ensureLeaveAdBreak(false);
    });

    // player.on('aderror', function(e) {
    //   console.log('ERROR ENCOUNTERED: ', e);
    // });

    // HACK: HTTP 404 on the src will trigger a 'error' event;
    // add hack to convert it to adserror
    // player.on(['aderror'], function(e) {
    //   if (options.debug) { videojs.log.error('vast', 'aderror -> adserror'); }
    //   player.trigger('adserror');
    // });

    return vast;
  };

  var vast = function(options) {
    this.vast = vastFactory(this, options);
  };

  videojs.plugin('vast', vast);

});
