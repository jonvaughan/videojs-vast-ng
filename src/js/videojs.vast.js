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
        if (options.debug) { videojs.log('adbreak', _adbreak); }
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
      maxAdAttempts: 1,
      maxAdCount: 1,
      adParameters: {}
    }, options);

    options.customURLHandler = videojs.SwfURLHandler({ debug: options.debug });
  }

  videojs.plugin('vast', vast);

}(window, videojs, DMVAST));
