(function(window, videojs, dmvast, undefined) {
  'use strict';

  var parseXml;

  if (window.DOMParser) {
    parseXml = function(xmlStr) {
      return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
    };
  } else if (typeof window.ActiveXObject != "undefined" && new window.ActiveXObject("Microsoft.XMLDOM")) {
    parseXml = function(xmlStr) {
      var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
      xmlDoc.async = "false";
      xmlDoc.loadXML(xmlStr);
      return xmlDoc;
    };
  } else {
    parseXml = function() { return null; }
  }

  function vast(options) {
    var
      _player = this,
      _playerEl = _player.el(),
      _showContentControls,
      _sources,
      _companions,
      _tracker,
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

    var _setupTrackerEvents = function() {
      var
        errorOccurred = false,
        t = _tracker,
        canplayFn = function(e) {
          console.warn('vast', 'event', 'canplay', e);
          _tracker.load();
        },
        timeupdateFn = function() {
          if (isNaN(t.assetDuration)) {
            t.assetDuration = _player.duration();
          }
          t.setProgress(_player.currentTime());
        },
        pauseFn = function(e) {
          console.warn('vast', 'event', 'pause', e);
          t.setPaused(true);
          _player.one('play', function() {
            console.log('vast', 'event', 'pauseFn', 'play');
            t.setPaused(false);
          });
        },
        errorFn = function(e) {
          console.warn('vast', 'event', 'error', e);
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
      console.info('vast', 'block', 'clicked');
      if (_player.paused()) {
        _player.play();
        return false;
      }

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
        console.info('vast', 'init ui', 'skip < 0, disabling skip button');
        return;
      }

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

      videojs.insertFirst(_skipBtn, _playerEl);

      _player.on('timeupdate', _updateSkipBtn);
    };

    var _removeSkipBtn = function() {
      // remove skip button
      if (!_skipBtn || !_skipBtn.parentNode) {
        console.info('vast', 'remove', 'no skip button found:', _skipBtn);
        return;
      }

      _skipBtn.parentNode.removeChild(_skipBtn);
      _skipBtn = null;

      _player.off('timeupdate', _updateSkipBtn);
    }

    var _updateSkipBtn = function() {
      if (!_skipBtn) {
        _removeSkipBtn();
        return;
      }

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

    var _updateCompanions = function() {
      for(var i=0; i<_companions.variations.length; i++) {
        var comp = _companions.variations[i];
        var q = '#' + _player.id() + '-' + comp.width + 'x' + comp.height;
        var compEl = document.querySelector(q);

        if (!compEl) {
          console.debug('no companion element found:', q);
          continue;
        }

        if (comp.staticResource) {
          var img = new Image();
          img.src = comp.staticResource;
          img.width = comp.width;
          img.height = comp.height;

          var aEl = document.createElement('a');
          aEl.setAttribute('target', '_blank');
          aEl.href = comp.companionClickThroughURLTemplate
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
          console.debug('vast', 'ignoring companion: ', comp);
        }
      }
    }

    var _startAd = function() {
      console.debug('vast', 'startAd');

      _player.ads.startLinearAdMode();
      _showContentControls = _player.controls();

      if (_showContentControls) {
        _player.controls(false);
      }

      // load linear ad sources and start playing them
      _player.src(_sources);


      if (_tracker && !_sourceContainsVPAID(_sources)) {
        _player.on('click', _adClick);
        _addSkipBtn();
      }

      if (_companions) {
        console.info('startAd', 'add companions', _companions);
        _updateCompanions();
      }

      _setupTrackerEvents();

      _player.one('ended', _player.vast.remove);

      _player.play();
    };

    _player.vast.preroll = function() {

      if (!options.url) {
        _player.trigger('adscanceled');
        return;
      }

      // custom url handler for requesting VAST tags to bypass CORS problems
      var swfUrlHandlerOptions = {
        urlhandler: {
          supported: function() {
            return !!CrossXHR;
          },

          get: function(url, options, cb) {
            try {
              var xhr = new CrossXHR();
              xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                  console.debug('vast', 'vast response', parseXml(xhr.responseText));
                  cb(null, parseXml(xhr.responseText));
                }
              };
              console.debug('request to ', url);
              xhr.open('GET', url);
              xhr.send();
            } catch(e) {
              console.warn(e);
              cb();
            }
          }
        }
      };

      dmvast.client.get(options.url, options.flashxhr ? swfUrlHandlerOptions : undefined, function(response) {
        console.info('vast', 'preroll', 'response', response);
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
                    console.warn('vast', 'preroll', 'ignoring linear; already found one');
                    continue;
                  }

                  if (!creative.mediaFiles.length) {
                    console.warn('vast', 'preroll', 'ignoring linear; no media files found');
                    continue;
                  }

                  _tracker = new dmvast.tracker(ad, creative);

                  console.debug('vast', 'preroll', 'tracker', _tracker);

                  var sources = _createSourceObjects(creative.mediaFiles);

                  if (sources && sources.length) {
                    _sources = sources;
                    foundCreative = true;
                  }

                  break;

                case 'companion':

                  if (foundCompanion) {
                    console.warn('vast', 'preroll', 'ignoring companion; already found one');
                    continue;
                  }

                  _companions = creative;

                  foundCompanion = true;

                  break;

                default:

                  console.info('vast', 'preroll', 'unknown creative found:', creative);
              }
            }

            if (foundCreative) {
              console.debug('vast', 'preroll', 'found VAST');

              // vast tracker and content is ready to go, trigger event
              _startAd();
              return;
            }

            _sources = undefined;
            _companions = undefined;

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

      _player.off('click', _adClick);
      _removeSkipBtn();

      // show player controls for video
      if (_showContentControls) {
        console.debug('vast', 'remove', 'enable controls');
        _player.controls(true);
      }

      _sources = null;
      _companions = null;
      _tracker = null;

      // complete in async manner. Sometimes when shutdown too soon, video does not start playback
      _player.ads.endLinearAdMode();

      _player.play();
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

    _player.vast.sources = function() {
      return _sources;
    };

    _player.vast.flashxhr = function() {
      if (flashxhr === undefined) {
        return options.flashxhr;
      } else {
        options.flashxhr = flashxhr;
      }
    };

    // check that we have the ads plugin
    if (_player.ads === undefined) {
      console.error('vast', 'vast video plugin requires videojs-contrib-ads, vast plugin not initialized');
      return null;
    }

    _player.on('contentupdate', function(e) {
      console.info('vast', 'contentupdate', e.newValue);
      _player.trigger('adsready');
    });

    _player.on('readyforpreroll', function() {
      console.info('vast', 'readyforpreroll');

      // if we don't have a vast url, just bail out
      if (!options.url) {
        _player.trigger('adscanceled');
        return;
      }

      // set up and start playing preroll
      _player.vast.preroll();
    });

    // merge in default values
    options = videojs.util.mergeOptions({
      skip: 5,
      flashxhr: false
    }, options);
  };

  videojs.plugin('vast', vast);

}(window, videojs, DMVAST));
