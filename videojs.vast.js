(function(window, vjs, dmvast, undefined) {
  'use strict';

  // preserve support for older video.js versions
  function localize(player, text) {
    if (player && player.localize) {
      return player.localize(text);
    } else {
      return text;
    }
  }

  function removeClass(element, className) {
    var
      classes = element.className.split(/\s+/),
      i = classes.length,
      newClasses = [];
    while (i--) {
      if (classes[i] !== className) {
        newClasses.push(classes[i]);
      }
    }
    element.className = newClasses.join(' ');
  }

  var VPAIDClient = function(player, settings) {

    var
      vpaidObj,
      vpaidListeners = {};

    function onVPAID(event, func) {
      if (vpaidListeners[event] === undefined) {
        vpaidListeners[event] = [];
      }
      vpaidListeners[event].push(func);
      vpaidObj.subscribe(func, event);
    }

    function offVPAID(event, func) {
      vpaidObj.unsubscribe(func, event);
      if (vpaidListeners[event]) {
        var listeners = vpaidListeners[event],
          index = -1;
        if (!Array.prototype.indexOf) {
          for (var i = 0; i < listeners.length; i++) {
            if (listeners[i] === func) {
              index = i;
              break;
            }
          }
        } else {
          index = listeners.indexOf(func);
        }

        if (index !== -1) {
          listeners.splice(index, 1);
        }
        if (listeners.length === 0) {
          delete vpaidListeners[event];
        }
      }
    }

    function oneVPAID(event, func) {
      var wrapper = function() {
        offVPAID(event, wrapper);
        func();
      };
      onVPAID(event, wrapper);
    }

    function setTrackerDuration(vpaid, vastTracker) {
      if (vpaid.getAdDuration) {
        var duration = vpaid.getAdDuration();
        if (duration > 0) {
          vastTracker.setDuration(duration);
        }
      }
    }

    function setupVPAIDEvents(vpaid, vastTracker, adLoadedCallback) {
      onVPAID('AdError', function(e) {
        console.debug('vast-plugin', 'AdError', e);
        player.vast.tearDown();
      });

      oneVPAID('AdLoaded', function() {
        console.debug('vast-plugin', 'AdLoaded');

        if (adLoadedCallback) {
          adLoadedCallback(vpaid);
        }

        setTrackerDuration(vpaid, vastTracker);
      });

      oneVPAID('AdStopped', function() {
        console.debug('vast-plugin', 'AdStopped');
        player.vast.tearDown();
      });

      onVPAID('AdDurationChange', function() {
        console.debug('vast-plugin', 'AdDurationChange');
        setTrackerDuration(vpaid, vastTracker);
      });

      onVPAID('AdRemainingTimeChange', function() {
        console.debug('vast-plugin', 'AdRemainingTimeChange');
        setTrackerDuration(vpaid, vastTracker);
      });

      oneVPAID('AdSkipped', function() {
        console.debug('vast-plugin', 'AdSkipped');
        vastTracker.skip();
        player.vast.tearDown();
      });

      oneVPAID('AdStarted', function() {
        console.debug('vast-plugin', 'AdStarted');
        player.ads.startLinearAdMode();
        vastTracker.load();
        player.el().className = 'vjs-vpaid-started' + player.el().className;
      });

      onVPAID('AdVolumeChange', function() {
        console.debug('vast-plugin', 'AdVolumeChange');
        vastTracker.setMuted(vpaidObj.getAdVolume() === 0);
        player.setVolume(vpaidObj.getAdVolume());
      });

      onVPAID('AdImpression', function() {
        console.debug('vast-plugin', 'AdImpression');
        //TODO
      });

      onVPAID('AdVideoStart', function() {
        console.debug('vast-plugin', 'AdVideoStart');
        vastTracker.setProgress(0);
        if (!player.paused()) {
          player.pause();
        }
      });

      onVPAID('AdVideoFirstQuartile', function() {
        console.debug('vast-plugin', 'AdVideoFirstQuartile');
        var emulatedFirstQuartile = Math.round(25 * vpaidObj.getAdDuration()) / 100;
        vastTracker.setProgress(emulatedFirstQuartile);
      });

      onVPAID('AdVideoMidpoint', function() {
        console.debug('vast-plugin', 'AdVideoMidpoint');
        var emulatedMidpoint = Math.round(50 * vpaidObj.getAdDuration()) / 100;
        vastTracker.setProgress(emulatedMidpoint);
      });

      onVPAID('AdVideoThirdQuartile', function() {
        console.debug('vast-plugin', 'AdVideoThirdQuartile');
        var emulatedThirdQuartile = Math.round(75 * vpaidObj.getAdDuration()) / 100;
        vastTracker.setProgress(emulatedThirdQuartile);
      });

      onVPAID('AdVideoComplete', function() {
        console.debug('vast-plugin', 'AdVideoComplete');
        vastTracker.setProgress(vpaidObj.getAdDuration());
      });

      onVPAID('AdClickThru', function(url, id, playerHandles) {
        console.debug('vast-plugin', 'AdClickThru');
        vastTracker.click();
        if (playerHandles) {
          if (!url) {
            url = player.vast.getClickThrough();
          }

          //TODO open url
        }
      });

      onVPAID('AdUserAcceptInvitation', function() {
        console.debug('vast-plugin', 'AdUserAcceptInvitation');
        //TODO implement in vast client
        vastTracker.acceptInvitation();
      });

      onVPAID('AdUserClose', function() {
        console.debug('vast-plugin', 'AdUserClose');
        vastTracker.close();
      });

      onVPAID('AdPaused', function() {
        console.debug('vast-plugin', 'AdPaused');
        vastTracker.setPaused(true);
      });

      onVPAID('AdPlaying', function() {
        console.debug('vast-plugin', 'AdPlaying');
        vastTracker.setPaused(false);
      });

      onVPAID('AdSkippableStateChange', function() {
        console.debug('vast-plugin', 'AdSkippableStateChange');
        if (vpaidObj.getAdSkippableState()) {
          player.vast.createSkipButton();
          player.vast.enableSkipButton();
        } else if (player.vast.skipButton) {
          player.vast.skipButton.parentNode.removeChild(player.vast.skipButton);
        }
      });
    }

    function loadResource(mediaFile, callback) {
      if (mediaFile.mimeType !== "application/javascript") {
        throw new Error("Loading not javascript vpaid ads is not supported");
      }

      vpaidIFrame = document.createElement('iframe');
      vpaidIFrame.style.display = 'none';
      vpaidIFrame.onload = function() {
        var iframeDoc = vpaidIFrame.contentDocument;
        //Credos http://stackoverflow.com/a/950146/51966
        // Adding the script tag to the head as suggested before
        var head = iframeDoc.getElementsByTagName('head')[0];
        var script = iframeDoc.createElement('script');
        script.type = 'text/javascript';
        script.src = mediaFile.fileURL;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.

        var onloadCallback = function() {
          if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
            if (vpaidIFrame.contentWindow.getVPAIDAd === undefined) {
              console.debug('vast-plugin', 'loadResource', 'onload', 'Unable to load script or script do not have getVPAIDAd method');
              return;
            }

            callback(vpaidIFrame.contentWindow.getVPAIDAd());
          }
        };

        // backwards-compatibility: https://msdn.microsoft.com/en-us/library/ie/hh180173%28v=vs.85%29.aspx
        if(script.addEventListener) {
          script.addEventListener("load", onloadCallback);
        } else if (script.readyState) {
          script.onreadystatechange = onloadCallback;
        }

        head.appendChild(script);
      };

      document.body.appendChild(vpaidIFrame);
    }

    function updateSeeker(vpaidSeeker) {
      if (!vpaidObj && vpaidTrackInterval !== -1) { //might be it was shutdown earlier than first seek could appear. Silently remove itself
        clearInterval(vpaidTrackInterval);
        vpaidTrackInterval = -1;
        return;
      }
      var remaining = vpaidObj.getAdRemainingTime();
      if (remaining < 0) {
        return;
      }
      var total = vpaidObj.getAdDuration();
      if (total < 0) {
        return;
      }
      var progress = vpaidSeeker.querySelector('.vjs-play-progress');
      progress.style.width = ((total - remaining) / total * 100) + '%';

      //taken from videojs-iva
      var remainingMinutes = Math.floor(remaining / 60);
      var remainingSeconds = Math.floor(remaining % 60);
      if (remainingSeconds.toString().length < 2) {
        remainingSeconds = '0' + remainingSeconds;
      }
      var remains = remainingMinutes + ':' + remainingSeconds;
      progress.innerHTML = '<span class="vjs-control-text">' + remains + '</span>';
      vpaidSeeker.querySelector('.vast-ad-left').innerHTML = remains;
    }

    function init(vpaidMediaFile, vpaidPlayer, adLoadedCallback) {
      loadResource(vpaidMediaFile, function(vpaid) {

        player.vpaid = vpaidObj = vpaid;

        if (vpaid.handshakeVersion('2.0') !== '2.0') {
          throw new Error("Versions different to 2.0 are not supported");
        }

        var playerEl = player.el();
        var pref = {
          videoSlotCanAutoPlay: true,
          slot: playerEl,
          videoSlot: vpaidPlayer
        };
        playerEl.insertBefore(vpaidPlayer, player.controlBar.el());

        var clickToPlay = function() {
          if (player.paused()) {
            console.debug('vast-plugin', 'blocker', 'click');
            player.play();
          }

          // player.off('play', clickToPlay);
          // player.off('click', clickToPlay);
        };

        player.one('play', clickToPlay);

        player.one('click', clickToPlay);

        player.on('resize', function() {
          vpaid.resizeAd(player.width(), player.height(), settings.viewMode);
        });

        player.on('fullscreenchange', function() {
          if (player.isFullScreen()) {
            vpaid.resizeAd(0, 0, 'fullscreen');
          } else {
            vpaid.resizeAd(player.width, player.width, settings.viewMode);
          }
        });

        player.on('adtimeout', function() {
          player.vast.tearDown();
        });

        setupVPAIDEvents(vpaid, player.vastTracker, adLoadedCallback);

        //TODO add creativeData
        vpaid.initAd(player.width(), player.height(), settings.viewMode, settings.bitrate, {}, pref);
      });
    }

    function dispose() {
      if (vpaidObj) {
        for (var event in vpaidListeners) {
          if (!vpaidListeners.hasOwnProperty(event)) {
            continue;
          }
          var listeners = vpaidListeners[event];
          for (var i = 0; i < listeners.length; i++) {
            vpaidObj.unsubscribe(listeners[i], event);
          }
        }

        vpaidObj = null;
        vpaidListeners = {};
      }

      removeClass(player.el(), 'vjs-vpaid-started');
    }

    return {
      init: init,
      vpaid: vpaidObj,
      vpaidTrackInterval: vpaidTrackInterval,
      updateSeeker: updateSeeker,
      dispose: dispose
    };
  }; // end VPAIDClient

  //Find optimal available VPAID tech. Best match is javascript, otherwise last found will be returned
  function firstSupportedVPAIDMediaFile(mediaFiles) {
    for (var i = 0; i < mediaFiles.length; i++) {
      var mf = mediaFiles[i];

      if (mf.apiFramework === "VPAID" && mf.mimeType === 'application/javascript') {
        return mf;
      }
    }

    console.warn('vast-plugin', 'firstSupportedVPAIDMediaFile', 'application/javascript mime type not found');

    return null;
  }

  function createSourceObjects(mediaFiles, techOrder) {
    var sourcesByFormat = {}, i, j, t, techName, tech, sbf;

    for (i = 0; i < techOrder.length; i++) {
      t = techOrder[i];
      techName = t.charAt(0).toUpperCase() + t.slice(1);
      tech = window.videojs[techName];
      sbf = sourcesByFormat[t] = [];

      // Check if the current tech is defined before continuing
      if (!tech) {
        console.warn('vast-plugin', 'createSourceObjects', 'skipping "' + techName + '"; tech not found');
        continue;
      }

      // Check if the browser supports this technology
      if (!tech.isSupported()) {
        console.warn('vast-plugin', 'createSourceObjects', 'skipping "' + techName + '"; tech not supported');
        continue;
      }

      // Loop through each source object
      for (j = 0; j < mediaFiles.length; j++) {
        var f = mediaFiles[j];

        var source = {
          type: f.mimeType,
          src: f.fileURL,
          width: f.width,
          height: f.height
        };

        // Check if source can be played with this technology
        if (!tech.canPlaySource(source)) {
          // console.debug('vast-plugin', 'createSourceObjects', 'source not supported:', source);
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
        console.debug('vast-plugin', 'createSourceObjects', 'no sources found for tech:', tech);
        continue;
      }

      for (j = 0; j < sourcesByFormat[tech].length; j++) {
        sources.push(sourcesByFormat[tech][j]);
      }
    }

    return sources;
  }

  function extend(obj) {
    var arg, i, k;
    for (i = 1; i < arguments.length; i++) {
      arg = arguments[i];
      for (k in arg) {
        if (arg.hasOwnProperty(k)) {
          obj[k] = arg[k];
        }
      }
    }
    return obj;
  }

  var

  vpaidIFrame,

  vpaidPlayer,

  vpaidTrackInterval,

  vpaidSeeker,

  showContentControls,

  defaults = {
    skip: 5, // seconds before skip button shows, negative values to disable skip button altogether
    bitrate: 1000, //advised bitrate for VPAID ads
    viewMode: 'normal', //view mode for VPAID ads. Possible values: normal, thumbnail, fullscreen
    vpaidElement: undefined //html element used for vpaid ads
  },

  Vast = function (player, settings) {

    var vpaidClient = new VPAIDClient(player, settings);

    function vpaidClientReady() {
      console.debug('vast-plugin', 'vpaidClient', 'init');
      createVPAIDControls();
      player.trigger('vast-ready');
    }

    function getOrCreateVPAIDPlayer() {
      var vpaidPlayer;

      if (/iphone|ipad|android/gi.test(navigator.userAgent)) {
        vpaidPlayer = player.el().querySelector('.vjs-tech');
        if (vpaidPlayer.tagName !== 'video') { //might be using non-default source, fallback to custom video slot
          vpaidPlayer = undefined;
        }
      }

      if (!vpaidPlayer) {
        vpaidPlayer = document.createElement('video');
        vpaidPlayer.className = 'vast-blocker';
      }

      return vpaidPlayer;
    }

    function requestAd() {

      if (!settings.url) {
        player.trigger('adscanceled');
        return;
      }

      // query vast url given in settings
      dmvast.client.get(settings.url, function(response) {
        console.warn('vast-plugin', 'requestAd', 'response', response);
        if (response) {
          // TODO: Rework code to utilize multiple ADs

          // we got a response, deal with it
          for (var i = 0; i < response.ads.length; i++) {
            var ad = response.ads[i];
            var vpaidMediaFile;
            var foundCreative = false, foundCompanion = false, foundVPAID = false, foundVAST = false;
            for (var j = 0; j < ad.creatives.length && (!foundCreative || !foundCompanion); j++) {
              var creative = ad.creatives[j];

              switch(creative.type) {
                case 'linear':

                  if (foundCreative) {
                    console.warn('vast-plugin', 'requestAd', 'ignoring linear; already found one');
                    continue;
                  }

                  if (!creative.mediaFiles.length) {
                    console.warn('vast-plugin', 'requestAd', 'ignoring linear; no media files found');
                    continue;
                  }

                  player.vastTracker = new dmvast.tracker(ad, creative);

                  var sources = createSourceObjects(creative.mediaFiles, player.options().techOrder);

                  if (sources && sources.length) {
                    player.vast.sources = sources;
                    foundVAST = true;
                  } else {
                    // try to find a VPAID media file
                    vpaidMediaFile = firstSupportedVPAIDMediaFile(creative.mediaFiles);

                    foundVPAID = !!vpaidMediaFile;
                  }

                  foundCreative = foundVAST || foundVPAID;

                  break;

                case 'companion':

                  if (foundCompanion) {
                    console.warn('vast-plugin', 'requestAd', 'ignoring companion; already found one');
                    continue;
                  }

                  player.vast.companion = creative;

                  foundCompanion = true;

                  break;

                default:

                  console.info('vast-plugin', 'requestAd', 'unknown creative found:', creative);
              }
            }

            if (foundVPAID) {
              console.debug('vast-plugin', 'requestAd', 'found VPAID');
              vpaidPlayer = getOrCreateVPAIDPlayer();
              vpaidClient.init(vpaidMediaFile, vpaidPlayer, vpaidClientReady);
              return;
            } else if (foundVAST) {
              console.debug('vast-plugin', 'requestAd', 'found VAST');
              // vast tracker and content is ready to go, trigger event
              player.trigger('vast-ready');
              return;
            }

            player.vast.sources = undefined;
            player.vast.companion = undefined;
            vpaidMediaFile = undefined;

            // Inform ad server we can't find suitable media file for this ad
            dmvast.util.track(ad.errorURLTemplates, {ERRORCODE: 403});
          }
        }

        // No preroll found
        player.trigger('adscanceled');
      });
    }

    function setupVASTEvents(vastTracker) {
      var
        errorOccurred = false,
        canplayFn = function(e) {
          console.warn('vast-plugin', 'setupVASTEvents', 'canplay', e);
          vastTracker.load();
        },
        timeupdateFn = function() {
          if (isNaN(vastTracker.assetDuration)) {
            vastTracker.assetDuration = player.duration();
          }
          vastTracker.setProgress(player.currentTime());
        },
        pauseFn = function(e) {
          console.warn('vast-plugin', 'setupVASTEvents', 'pause', e);
          vastTracker.setPaused(true);
          player.one('play', function() {
            console.log('vast-plugin', 'setupVASTEvents', 'pauseFn', 'play');
            vastTracker.setPaused(false);
          });
        },
        errorFn = function(e) {
          console.warn('vast-plugin', 'setupVASTEvents', 'error', e);
          // Inform ad server we couldn't play the media file for this ad
          dmvast.util.track(vastTracker.ad.errorURLTemplates, {ERRORCODE: 405});
          errorOccurred = true;
          player.trigger('ended');
        };

      player.on('canplay', canplayFn);
      player.on('timeupdate', timeupdateFn);
      player.on('pause', pauseFn);
      player.on('error', errorFn);

      player.one('vast-preroll-removed', function() {
        player.off('canplay', canplayFn);
        player.off('timeupdate', timeupdateFn);
        player.off('pause', pauseFn);
        player.off('error', errorFn);
        if (!errorOccurred) {
          vastTracker.complete();
        }
      });
    }

    function prerollVAST(vastTracker) {
      player.ads.startLinearAdMode();
      showContentControls = player.controls();
      if (showContentControls) {
        player.controls(false);
      }

      // load linear ad sources and start playing them
      player.src(player.vast.sources);

      var clickthrough;
      if (vastTracker.clickThroughURLTemplate) {
        clickthrough = dmvast.util.resolveURLTemplates(
          [vastTracker.clickThroughURLTemplate],
          {
            CACHEBUSTER: Math.round(Math.random() * 1.0e+10),
            CONTENTPLAYHEAD: vastTracker.progressFormated()
          }
        )[0];
      }
      var blocker = window.document.createElement("a");
      blocker.className = "vast-blocker";
      blocker.href = clickthrough || "#";
      blocker.target = "_blank";
      blocker.onclick = function() {
        console.info('vast-plugin', 'preroll', 'clicked');
        if (player.paused()) {
          console.debug('vast-plugin', 'blocker', 'click');
          player.play();
          return false;
        }
        var clicktrackers = vastTracker.clickTrackingURLTemplate;
        if (clicktrackers) {
          vastTracker.trackURLs([clicktrackers]);
        }
        player.trigger("adclick");
      };
      player.vast.blocker = blocker;
      player.el().insertBefore(blocker, player.controlBar.el());

      var skipButton = window.document.createElement("div");
      skipButton.className = "vast-skip-button";
      if (settings.skip < 0) {
        skipButton.style.display = "none";
      }
      player.vast.skipButton = skipButton;
      player.el().appendChild(skipButton);

      player.on("timeupdate", player.vast.timeupdate);

      skipButton.onclick = function(e) {
        if((' ' + player.vast.skipButton.className + ' ').indexOf(' enabled ') >= 0) {
          vastTracker.skip();
          player.vast.tearDown();
        }
        if(window.Event.prototype.stopPropagation !== undefined) {
          e.stopPropagation();
        } else {
          return false;
        }
      };

      setupVASTEvents(vastTracker);

      player.one('ended', player.vast.tearDown);

      player.trigger('vast-preroll-ready');
    }

    function prerollVPAID(vpaid) {
      player.ads.startLinearAdMode();
      showContentControls = player.controls();
      if (showContentControls) {
        player.controls(false);
      }
      vpaid.startAd();
      vpaidTrackInterval = setInterval(function() { vpaidClient.updateSeeker(vpaidSeeker); }, 500);
    }

    function tearDown() {
      console.debug('vast-plugin', 'tearDown');
      // remove preroll buttons
      if (player.vast.skipButton && player.vast.skipButton.parentNode) {
        player.vast.skipButton.parentNode.removeChild(player.vast.skipButton);
        player.vast.skipButton = null;
      } else {
        console.info('vast-plugin', 'tearDown', 'no skip button found:', player.vast.skipButton);
      }

      if (player.vast.blocker && player.vast.blocker.parentNode) {
        player.vast.blocker.parentNode.removeChild(player.vast.blocker);
        player.vast.blocker = null;
      } else {
        console.info('vast-plugin', 'tearDown', 'no blocker found:', player.vast.blocker);
      }

      // remove vast-specific events
      player.off('timeupdate', player.vast.timeupdate);
      player.off('ended', player.vast.tearDown);

      if (vpaidPlayer) {
        vpaidPlayer.parentNode.removeChild(vpaidPlayer);
        vpaidPlayer = null;
      }

      if (vpaidIFrame) {
        vpaidIFrame.parentNode.removeChild(vpaidIFrame);
        vpaidIFrame = null;
      }

      if (vpaidTrackInterval) {
        clearInterval(vpaidTrackInterval);
        vpaidTrackInterval = null;
      }

      // show player controls for video
      if (showContentControls) {
        console.debug('vast-plugin', 'tearDown', 'enable controls');
        player.controls(true);
      }

      console.debug('vast-plugin', 'tearDown', 'removeVPAIDControls');
      removeVPAIDControls();

      console.debug('vast-plugin', 'tearDown', 'vpaidClient dispose');
      vpaidClient.dispose();

      if (player.vast.sources) {
        player.vast.sources = null;
      }

      if (player.vast.companion) {
        player.vast.companion = null;
      }

      if (player.vpaid) {
        player.vpaid = null;
      }

      if (player.vastTracker) {
        player.vastTracker = null;
      }

      //complete in async manner. Sometimes when shutdown too soon, video does not start playback
      console.debug('vast-plugin', 'tearDown', 'endLinearAdMode!!');
      player.ads.endLinearAdMode();

      player.trigger('vast-preroll-removed');
    }

    function createVPAIDControls() {
      vpaidSeeker = document.createElement('div');
      vpaidSeeker.className = 'vast-ad-control';
      vpaidSeeker.innerHTML = '<span class="vast-advertisement">' + localize(player, 'Advertisement') + ' <span class="vast-ad-left"></span></span><div class="vast-progress-holder"><div class="vjs-play-progress"></div></div>';
      player.el().appendChild(vpaidSeeker, player.el().childNodes[0]);
    }

    function removeVPAIDControls() {
      if (vpaidSeeker && vpaidSeeker.parentNode) {
        vpaidSeeker.parentNode.removeChild(vpaidSeeker);
        vpaidSeeker = null;
      }
    }

    function timeupdate() {
      player.loadingSpinner.el().style.display = "none";
      var timeLeft = Math.ceil(settings.skip - player.currentTime());
      if(timeLeft > 0) {
        player.vast.skipButton.innerHTML = "Skip in " + timeLeft + "...";
      } else {
        if((' ' + player.vast.skipButton.className + ' ').indexOf(' enabled ') === -1) {
          player.vast.skipButton.className += " enabled";
          player.vast.skipButton.innerHTML = "Skip";
        }
      }
    }

    // return vast plugin
    return {
      skip: function(skip) {
        if (skip === undefined) {
          return settings.skip;
        } else {
          settings.skip = skip;
        }
      },

      bitrate: function(bitrate) {
        if (bitrate === undefined) {
          return settings.bitrate;
        } else {
          settings.bitrate = bitrate;
        }
      },

      viewMode: function(viewMode) {
        if (viewMode === undefined) {
          return settings.viewMode;
        } else {
          settings.viewMode = viewMode;
        }
      },

      vpaidElement: function(vpaidElement) {
        if (vpaidElement === undefined) {
          return settings.vpaidElement;
        } else {
          settings.vpaidElement = vpaidElement;
        }
      },

      url: function(url) {
        if (url === undefined) {
          return settings.url;
        } else {
          settings.url = url;
        }
      },

      requestAd: requestAd,

      tearDown: tearDown,

      prerollVAST: prerollVAST,

      prerollVPAID: prerollVPAID,

      timeupdate: timeupdate
    };

  },

  vastPlugin = function(options) {
    var player = this;
    var settings = extend({}, defaults, options || {});

    // check that we have the ads plugin
    if (player.ads === undefined) {
      console.error('vast-plugin', 'vast video plugin requires videojs-contrib-ads, vast plugin not initialized');
      return null;
    }

    // set up vast plugin, then set up events here
    player.vast = new Vast(player, settings);

    player.on('vast-ready', function () {
      // vast is prepared with content, set up ads and trigger ready function
      player.trigger('adsready');
    });

    player.on('vast-preroll-ready', function () {
      // start playing preroll, note: this should happen this way no matter what, even if autoplay
      //  has been disabled since the preroll function shouldn't run until the user/autoplay has
      //  caused the main video to trigger this preroll function
      player.play();
    });

    player.on('vast-preroll-removed', function () {
      console.info('vast-plugin', 'vast-preroll-removed');
      // preroll done or removed, start playing the actual video
      player.play();
    });

    player.on('contentupdate', function() {
      // videojs-ads triggers this when src changes
      setTimeout(player.vast.requestAd, 1);
    });

    player.on('readyforpreroll', function() {
      // if we don't have a vast url, just bail out
      if (!settings.url) {
        player.trigger('adscanceled');
        return;
      }

      // set up and start playing preroll
      if (player.vast.sources) {
        player.vast.prerollVAST(player.vastTracker);
      } else {
        player.vast.prerollVPAID(player.vpaid);
      }
    });

    // return player to allow this plugin to be chained
    return player;
  };

  vjs.plugin('vast', vastPlugin);

}(window, videojs, DMVAST));
