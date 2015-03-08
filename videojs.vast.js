(function(window, videojs, dmvast, undefined) {
  'use strict';

  function vast(options) {
    var
      _player = this,
      _playerEl = _player.el(),
      _showContentControls,
      _sources,
      _companion,
      _tracker,
      _blockerEl,
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
          console.warn('vast', 'createSourceObjects', 'skipping "' + techName + '"; tech not found');
          continue;
        }

        // Check if the browser supports this technology
        if (!tech.isSupported()) {
          console.warn('vast', 'createSourceObjects', 'skipping "' + techName + '"; tech not supported');
          continue;
        }

        // Loop through each source object
        for (j = 0; j < mediaFiles.length; j++) {
          var f = mediaFiles[j];

          var source = {
            type: f.mimeType,
            src: f.fileURL,
            apiFramework: f.apiFramework,
            width: f.width,
            height: f.height
          };

          // Check if source can be played with this technology
          if (!tech.canPlaySource(source)) {
            // console.debug('vast', 'createSourceObjects', 'source not supported:', source);
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
          console.debug('vast', 'createSourceObjects', 'no sources found for tech:', tech);
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
    }

    var _sourceContainsJavascriptVPAID = function(sources) {
      for(var i=0; i<sources.length; i++) {
        if (sources[i].type === 'application/javascript') {
          return true;
        }
      }

      return false;
    };

    var _sourceContainsFlashVPAID = function(sources) {
      for(var i=0; i<sources.length; i++) {
        if (sources[i].type === 'application/x-shockwave-flash') {
          return true;
        }
      }

      return false;
    };

    var _setupVASTEvents = function() {
      var
        errorOccurred = false,
        t = _tracker,
        canplayFn = function(e) {
          console.warn('vast', 'setupVASTEvents', 'canplay', e);
          _tracker.load();
        },
        timeupdateFn = function() {
          if (isNaN(_tracker.assetDuration)) {
            t.assetDuration = _player.duration();
          }
          t.setProgress(_player.currentTime());
        },
        pauseFn = function(e) {
          console.warn('vast', 'setupVASTEvents', 'pause', e);
          t.setPaused(true);
          _player.one('play', function() {
            console.log('vast', 'setupVASTEvents', 'pauseFn', 'play');
            t.setPaused(false);
          });
        },
        errorFn = function(e) {
          console.warn('vast', 'setupVASTEvents', 'error', e);
          // Inform ad server we couldn't play the media file for this ad
          dmvast.util.track(t.ad.errorURLTemplates, {ERRORCODE: 405});
          errorOccurred = true;
          _player.trigger('ended');
        };

      _player.on('canplay', canplayFn);
      _player.on('timeupdate', timeupdateFn);
      _player.on('pause', pauseFn);
      _player.on('error', errorFn);

      _player.one('vast-preroll-removed', function() {
        _player.off('canplay', canplayFn);
        _player.off('timeupdate', timeupdateFn);
        _player.off('pause', pauseFn);
        _player.off('error', errorFn);
        if (!errorOccurred) {
          t.complete();
        }
      });
    };

    var _addBlocker = function() {
      var clickthrough;

      if (!_tracker) {
        console.error('vast', '_addBlocker', 'cannot add blocker because tracker is null!');
        return;
      }

      if (_tracker.clickThroughURLTemplate) {
        clickthrough = dmvast.util.resolveURLTemplates(
          [_tracker.clickThroughURLTemplate],
          {
            CACHEBUSTER: Math.round(Math.random() * 1.0e+10),
            CONTENTPLAYHEAD: _tracker.progressFormated()
          }
        )[0];
      }

      _blockerEl = videojs.Component.prototype.createEl('a', {
        className: 'vast-blocker',
        href: clickthrough || "#",
        target: '_blank',
        onclick: function() {
          console.info('vast', 'preroll', 'clicked');
          if (_player.paused()) {
            console.debug('vast', 'blocker', 'click');
            _player.play();
            return false;
          }
          var clicktrackers = _tracker.clickTrackingURLTemplate;
          if (clicktrackers) {
            _tracker.trackURLs([clicktrackers]);
          }
          _player.trigger('adclick');
        }
      });
      videojs.insertFirst(_blockerEl, _playerEl);

      _skipBtn = videojs.Component.prototype.createEl('div', {
        className: 'vast-skip-button',
        onclick: function(e) {
          if((' ' + _skipBtn.className + ' ').indexOf(' enabled ') >= 0) {
            _tracker.skip();
            _player.vast.remove();
          }
          if(window.Event.prototype.stopPropagation !== undefined) {
            e.stopPropagation();
          } else {
            return false;
          }
        }
      });

      if (options.skip < 0) {
        _skipBtn.style.display = 'none';
      }

      videojs.insertFirst(_skipBtn, _playerEl);

      _player.on('timeupdate', _player.vast.timeupdate);

      _setupVASTEvents();

      _player.one('ended', _player.vast.remove);
    }

    _player.vast.preroll = function() {
      console.debug('vast', 'preroll');

      _player.ads.startLinearAdMode();
      _showContentControls = _player.controls();

      if (_showContentControls) {
        _player.controls(false);
      }

      // load linear ad sources and start playing them
      _player.src(_sources);

      if (!_sourceContainsVPAID(_sources)) {
        _addBlocker();
      }

      _player.trigger('vast-preroll-ready');
    };

    _player.vast.timeupdate = function() {
      _player.loadingSpinner.el().style.display = "none";
      var timeLeft = Math.ceil(options.skip - _player.currentTime());
      if(timeLeft > 0) {
        _skipBtn.innerHTML = "Skip in " + timeLeft + "...";
      } else {
        if((' ' + _skipBtn.className + ' ').indexOf(' enabled ') === -1) {
          _skipBtn.className += " enabled";
          _skipBtn.innerHTML = "Skip";
        }
      }
    };

    _player.vast.create = function() {

      if (!options.url) {
        _player.trigger('adscanceled');
        return;
      }

      // query vast url given in options
      dmvast.client.get(options.url, function(response) {
        console.warn('vast', 'create', 'response', response);
        if (response) {
          // TODO: Rework code to utilize multiple ADs

          // we got a response, deal with it
          for (var i = 0; i < response.ads.length; i++) {
            var ad = response.ads[i];
            var foundCreative = false, foundCompanion = false;
            for (var j = 0; j < ad.creatives.length && (!foundCreative || !foundCompanion); j++) {
              var creative = ad.creatives[j];

              switch(creative.type) {
                case 'linear':

                  if (foundCreative) {
                    console.warn('vast', 'create', 'ignoring linear; already found one');
                    continue;
                  }

                  if (!creative.mediaFiles.length) {
                    console.warn('vast', 'create', 'ignoring linear; no media files found');
                    continue;
                  }

                  _tracker = new dmvast.tracker(ad, creative);

                  console.debug('vast', 'create', 'tracker', _tracker);

                  var sources = _createSourceObjects(creative.mediaFiles);

                  if (sources && sources.length) {
                    _sources = sources;
                    foundCreative = true;
                  }

                  break;

                case 'companion':

                  if (foundCompanion) {
                    console.warn('vast', 'create', 'ignoring companion; already found one');
                    continue;
                  }

                  _companion = creative;

                  foundCompanion = true;

                  break;

                default:

                  console.info('vast', 'create', 'unknown creative found:', creative);
              }
            }

            if (foundCreative) {
              console.debug('vast', 'create', 'found VAST');
              // vast tracker and content is ready to go, trigger event
              _player.trigger('vast-ready');
              return;
            }

            _sources = undefined;
            _companion = undefined;

            // Inform ad server we can't find suitable media file for this ad
            dmvast.util.track(ad.errorURLTemplates, {ERRORCODE: 403});
          }
        }

        // No preroll found
        _player.trigger('adscanceled');
      });
    };

    _player.vast.remove = function() {
      console.debug('vast', 'remove');

      // remove skip button
      if (_skipBtn && _skipBtn.parentNode) {
        _skipBtn.parentNode.removeChild(_skipBtn);
        _skipBtn = null;
      } else {
        console.info('vast', 'remove', 'no skip button found:', _skipBtn);
      }

      // remove blocker
      if (_blockerEl && _blockerEl.parentNode) {
        _blockerEl.parentNode.removeChild(_blockerEl);
        _blockerEl = null;
      } else {
        console.info('vast', 'remove', 'no blocker found:', _blockerEl);
      }

      // remove vast-specific events
      _player.off('timeupdate', _player.vast.timeupdate);
      _player.off('ended', _player.vast.remove);

      // show player controls for video
      if (_showContentControls) {
        console.debug('vast', 'remove', 'enable controls');
        _player.controls(true);
      }

      _sources = null;
      _companion = null;
      _tracker = null;

      // complete in async manner. Sometimes when shutdown too soon, video does not start playback
      _player.ads.endLinearAdMode();

      _player.trigger('vast-preroll-removed');
    }

    _player.vast.tracker = function() {
      return _tracker;
    }

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

    // check that we have the ads plugin
    if (_player.ads === undefined) {
      console.error('vast', 'vast video plugin requires videojs-contrib-ads, vast plugin not initialized');
      return null;
    }

    _player.on('vast-ready', function () {
      console.info('vast', 'vast-ready');
      // vast is prepared with content, set up ads and trigger ready function

      _player.trigger('adsready');
    });

    _player.on('vast-preroll-ready', function () {
      console.info('vast', 'vast-preroll-ready');
      // start playing preroll, note: this should happen this way no matter what, even if autoplay
      //  has been disabled since the preroll function shouldn't run until the user/autoplay has
      //  caused the main video to trigger this preroll function
      _player.play();
    });

    _player.on('vast-preroll-removed', function () {
      console.info('vast', 'vast-preroll-removed');
      // preroll done or removed, start playing the actual video
      _player.play();
    });

    _player.on('contentupdate', function(e) {
      console.info('vast', 'contentupdate', e.newValue);

      // setTimeout(_player.vast.create, 0);
      _player.vast.create();
    });

    _player.on('readyforpreroll', function() {
      console.info('vast', 'readyforpreroll');
      // if we don't have a vast url, just bail out
      if (!options.url) {
        _player.trigger('adscanceled');
        return;
      }

      // if (!_tracker) {
      //   console.debug('vast', 'readyforpreroll', 'no tracker found: calling vast.create()');
      //   _player.vast.create();
      // }

      // set up and start playing preroll
      _player.vast.preroll();
    });

    // merge in default values
    options = videojs.util.mergeOptions({
      skip: 5
    }, options);
  };

  videojs.plugin('vast', vast);

}(window, videojs, DMVAST));
