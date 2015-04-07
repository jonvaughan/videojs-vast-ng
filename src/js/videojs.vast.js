(function(window, videojs, dmvast, undefined) {
  'use strict';

  function vast(options) {
    var
      _player = this, // jshint ignore:line
      _playerEl = _player.el(),
      _showContentControls,
      _sources,
      _companions,
      _tracker,
      _adbreak,
      _skipBtn,
      _vastRequestCount = 0;

    _player.vast = _player.vast || {};

    var _createSourceObjects = function(mediaFiles) {
      var sourcesByFormat = {}, i, j, to, techName, tech, sbf, techOrder = _player.options().techOrder;

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

    var richTracker = function(tracker) {
      var
        errorOccurred = false,
        canplayFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'canplay'); }
          tracker.load();
        },
        durationchangeFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'durationchange'); }
          tracker.assetDuration = _player.duration();
        },
        timeupdateFn = function() {
          tracker.setProgress(_player.currentTime());
        },
        playFn = function() {
          if (options.debug) { videojs.log('vast', 'tracker', 'play'); }
          tracker.setPaused(false);
        },
        pauseFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'pause'); }
          tracker.setPaused(true);
        },
        errorFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'error'); }
          // Inform ad server we couldn't play the media file for this ad
          dmvast.util.track(tracker.ad.errorURLTemplates, {ERRORCODE: 405});
          errorOccurred = true;
          tracker.removeListeners();
          _player.vast.ensureLeaveAdBreak();
          _player.trigger('adserror');
        },
        endedFn = function(e) {
          if (options.debug) { videojs.log('vast', 'tracker', 'ended'); }

          if (!errorOccurred) {
            tracker.complete();
          }

          tracker.removeListeners();
        };

      tracker.addListeners = function() {
        if (options.debug) { videojs.log('vast', 'tracker', 'addListeners'); }
        _player.on('adcanplay', canplayFn);
        _player.on('addurationchange', durationchangeFn);
        _player.on('adtimeupdate', timeupdateFn);
        _player.on('adplay', playFn);
        _player.on('adpause', pauseFn);
        _player.on('aderror', errorFn);
        _player.on('adended', endedFn);
      };

      tracker.removeListeners = function() {
        if (options.debug) { videojs.log('vast', 'tracker', 'removeListeners'); }
        _player.off('adcanplay', canplayFn);
        _player.off('addurationchange', durationchangeFn);
        _player.off('adtimeupdate', timeupdateFn);
        _player.off('adplay', playFn);
        _player.off('adpause', pauseFn);
        _player.off('aderror', errorFn);
        _player.off('adended', endedFn);
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

      _player.on('adtimeupdate', _updateSkipBtn);
    };

    var _removeSkipBtn = function() {
      // remove skip button
      if (!_skipBtn || !_skipBtn.parentNode) {
        if (options.debug) { videojs.log('vast', 'remove', 'no skip button found:', _skipBtn); }
        return;
      }

      _skipBtn.parentNode.removeChild(_skipBtn);
      _skipBtn = null;

      _player.off('adtimeupdate', _updateSkipBtn);
    };

    var _updateSkipBtn = function() {
      if (options.debug) { videojs.log('vast', 'updateSkipBtn', _player.ads.state); }

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
      if (options.debug) { videojs.log('vast', 'starting linear ad break', _player.ads.state); }

      _player.ads.startLinearAdMode();

      if (_showContentControls === undefined) {
        _showContentControls = _player.controls();
      }

      // save state of player controls so we can restore them after the ad break
      if (_showContentControls) {
        _player.controls(false);
      }
    };

    var _endLinearAdBreak = function() {
      if (options.debug) { videojs.log('vast', 'ending linear ad break', _player.ads.state); }

      // restore state of player controls before the ad break
      if (_showContentControls) {
        _player.controls(true);
        _showContentControls = undefined;
      }

      _player.ads.endLinearAdMode();

      _adbreak = null;

      _player.play();
    };

    var _endAd = function(forceEndAdBreak) {
      if (options.debug) { videojs.log('vast', 'endAd', _player.ads.state); }

      _player.off('adended', _endAd);

      if (!_adbreak) {
        videojs.log.warn('vast', 'endAd', 'not playing an AD! state: ' + _player.ads.state);
        return;
      } else {
        if (options.debug) { videojs.log('vast', 'endAd', 'adbreak: ', _adbreak); }
      }

      _player.off('click', _adClick);
      _removeSkipBtn();

      _unloadVAST();

      // Decide if we want to call another AD to simulate VAST 3 AD Pods
      if (forceEndAdBreak === true ||
        _adbreak.attempts >= options.maxAdAttempts ||
        _adbreak.count >= options.maxAdCount) {
        _endLinearAdBreak();
      } else {
        _loadVAST(true);
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

      if (options.debug) { videojs.log('vast', 'startAd', 'ad src: ' + _player.src()); }

      // VPAID will handle it's own click events.
      // TODO: make the vast plugin handle it
      if (_tracker && _player.techName.indexOf('Vpaid') !== 0) {
        _player.on('click', _adClick);
        _addSkipBtn();
      }

      if (options.debug) { videojs.log('vast', 'using tech: ' + _player.techName); }

      if (_companions) {
        _updateCompanions();
      }

      _player.on('adended', _endAd);
      _player.play();
    };

    var _loadVAST = function(immediatePlayback) {
      if (options.debug) { videojs.log('vast', 'loadVAST'); }

      _adbreak.attempts++;
      _vastRequestCount++;

      // lastVastRequestCount will become a sort of identifier for the
      // current VAST request. The idea is to ignore previous vast
      // requests still in flight.
      var lastVastRequestCount = _vastRequestCount;

      if (!options.url) {
        _player.trigger('adscanceled');
        return;
      }

      if (options.debug && options.customURLHandler) {
        videojs.log('vast', 'loadVAST', 'using custom URLHandler');
      }

      var getOptions = {
        // withCredentials: true,
        urlhandler: options.customURLHandler,
        timeout: options.vastTimeout
      };

      // TODO: fails if options.url already contains querystring values
      var url;

      if (!videojs.util.isEmptyObject(options.adParameters)) {
        url = options.url + '?' + videojs.util.param(options.adParameters);
      } else {
        url = options.url;
      }

      dmvast.client.get(url, getOptions, function(response) {
        if (options.debug) { videojs.log('vast', 'loadVAST', 'response', response); }

        if (lastVastRequestCount !== _vastRequestCount) {
          if (options.debug) { videojs.log('vast', 'loadVAST', 'ignored response as another vast request is in flight!'); }
          return;
        }

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

                    _tracker = richTracker(new dmvast.tracker(ad, creative));
                    _tracker.addListeners();
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
                _player.trigger('adsready');
              }
              return;
            }

            _sources = undefined;
            _companions = undefined;

            // inform ad server we can't find suitable media file for this ad
            dmvast.util.track(ad.errorURLTemplates, {ERRORCODE: 403});
          }
        }

        // no ads found: lets cancel the ad break
        console.log("STATE: ", _player.ads.state);
        _player.trigger('adscanceled');
      });

      _player.trigger('vastrequesting');
    };

    var _unloadVAST = function() {
      if (options.debug) { videojs.log('vast', 'unloadVAST'); }

      _sources = null;
      _companions = null;

      if (_tracker) {
        _tracker.removeListeners();
      }

      _tracker = null;

      if (!_adbreak) {
        videojs.log.error('vast', 'unloadVAST', 'assertion: adbreak should be set!');
      }
    };

    _player.vast.requestAdBreak = function() {
      if (options.debug) { videojs.log('vast', 'requestAdBreak', _player.ads.state); }

      switch(_player.ads.state) {
        case 'content-set':
        case 'content-resuming':
        case 'ad-playback': // hit when next/previous is triggered
        case 'ads-ready?':
          break;

        default:
          if (options.debug) {
            videojs.log('vast', 'requestAdBreak', 'ignored: ads state ' +
            _player.ads.triggerevent + ' -> ' + _player.ads.state);
          }
          return;
      }

      _adbreak = {
        attempts: 0,
        count: 0
      };

      if (options.url) {
        _loadVAST();
      } else {
        _player.trigger('adscanceled');
      }
    };

    _player.vast.ensureLeaveAdBreak = function() {
      if (options.debug) { videojs.log('vast', 'ensureLeaveAdBreak'); }

      _endAd(true);
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

    _player.vast.adParameters = function(adParameters) {
      if (adParameters === undefined) {
        return options.adParameters;
      } else {
        options.adParameters = adParameters;
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
      if (options.debug) { videojs.log('vast', 'contentupdate', 'ads.state: ' +
        _player.ads.state + ', newValue: ' + e.newValue); }

      // HACK: Chrome will sometimes fire contentupdate twice. Most browsers will have
      // e.newValue starting with 'http://...', but Chrome will sometimes fire two contentupdate
      // events from with e.newValue of 'ocean.mp4' and 'http://localhost:9000/ocean.mp4'.
      // This is not an issue if the src paths are absolute paths.
      if (e.newValue.indexOf('http') !== 0) {
        videojs.log.warn('duplicate contentupdate! \'' + e.oldValue + '\' to \'' + e.newValue + '\'');
        return;
      }

      if (!_player.paused()) {
        // HACK: Find the source of the problem so we don't have to resort
        // to this hackish code
        if (_adbreak) {
          _player.vast.ensureLeaveAdBreak();
        }

        _player.vast.requestAdBreak();
      }
    });

    _player.on(['next', 'previous'], function(e) {
      // HACK: Find the source of the problem so we don't have to resort
      // to this hackish code
      if (_adbreak) {
        _player.vast.ensureLeaveAdBreak();
      }

      _player.vast.requestAdBreak();
    });

    _player.on('contentended', function(e) {
      if (options.debug) { videojs.log('vast', 'contentended'); }

      if (_player.ads.state === 'postroll?') {
        // TODO: postroll
      }
    });

    _player.on('play', function() {
      if (options.debug) { videojs.log('vast', 'play'); }

      if (_adbreak) {
        if (options.debug) { videojs.log('vast', 'play', 'ignored: ad break already going running'); }
        return;
      }

      _player.vast.requestAdBreak();
    });

    _player.on('contentplayback', function(e) {
      if (options.debug) { videojs.log('vast', 'contentplayback', e.triggerevent); }
    });

    _player.on('contentpause', function(e) {
      if (options.debug) { videojs.log('vast', 'contentpause', e.triggerevent); }
    });

    _player.on('readyforpreroll', function() {
      if (options.debug) { videojs.log('vast', 'readyforpreroll'); }

      if (!_adbreak) {
        if (options.debug) { videojs.log.error('vast', 'readyforpreroll', 'no ad break found'); }
        _player.trigger('adserror');
        return;
      }

      _startAd();
    });

    // merge in default values
    options = videojs.util.mergeOptions({
      debug: false,
      skip: 5,
      customURLHandler: null,
      maxAdAttempts: 1,
      maxAdCount: 1,
      adParameters: {},
      vastTimeout: 5000
    }, options);
  }

  videojs.plugin('vast', vast);

}(window, videojs, DMVAST));
