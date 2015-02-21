(function () {
  'use strict';

  describe('videojs.vast plugin', function() {

    var
      videoEl,
      player,
      // sampleVast = 'http://videoads.theonion.com/vast/270.xml',
      sampleVast = 'base/spec/sample-vast.xml?id=1',
      sampleVast2 = 'base/spec/sample-vast.xml?id=2',
      sampleMp4 = {
        src: 'base/spec/files/small.mp4',
        type: 'video/mp4'
      },
      sampleWebm = {
        src: 'base/spec/files/small.webm',
        type: 'video/webm'
      },
      playerId = 'vid',
      isHeadless = /phantomjs/gi.test(window.navigator.userAgent);

    function injectVideoElement(id, video) {
      var sourceEl = document.createElement('source');
      sourceEl.setAttribute('src', video.src);
      sourceEl.setAttribute('type', video.type);
      var videoEl = document.createElement('video');
      videoEl.setAttribute('id', id);
      videoEl.setAttribute('controls', 'controls');
      videoEl.appendChild(sourceEl);
      document.body.appendChild(videoEl);

      if (isHeadless) {
        // PhantomJS doesn't have a video element implementation
        // force support here so that the HTML5 tech is still used during
        // command-line test runs
        videojs.Html5.isSupported = function() {
          return true;
        };
        videojs.Html5.prototype.play = function(){ };
        videojs.Html5.prototype.pause = function(){ };


        // provide implementations for any video element functions that are
        // used in the tests
        videoEl.load = function() {};
        videoEl.play = function() {};
      }

      return videoEl;
    }

    beforeEach(function() {

      videoEl = injectVideoElement(playerId, sampleMp4);

    });

    describe('Initialization', function() {

      beforeEach(function() {
        player = videojs(playerId);
      });

      afterEach(function(done) {
        setTimeout(function() {
          player.dispose();
          player = null;
          done();
        }, 100);
      });

      it('should bail out if player.ads isn\'t defined', function() {
        // Given
        spyOn(console, 'error').and.callThrough();
        player.ads = undefined;

        // When
        var result = player.vast({url:'i wanna go VAST!'});

        // Then
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('Requirements', function() {

      var player;

      var playerOptions;

      beforeEach(function() {
        playerOptions = {
          controls: true,
          plugins: {
            'ads': { }
          }
        };
      });

      afterEach(function(done) {
        // setTimeout hack around a .dispose() bug:
        // https://github.com/videojs/video.js/issues/1484
        setTimeout(function() {
          if (player) {
            player.dispose();
            player = null;
          }

          done();
        }, 100);
      });

      it('should bail out if no url is provided', function(done) {
        playerOptions.plugins.vast = {};

        player = videojs(playerId, playerOptions, function() {
          this.one('adscanceled', function() {
            done();
          });
        });
      });

      it('should bail out if empty url is provided', function(done) {
        playerOptions.plugins['vast'] = { url: '' };

        player = videojs(playerId, playerOptions, function() {
          this.one('adscanceled', function() {
            done();
          });
        });
      });

      it('should request an ad if a source is already loaded', function(done) {
        playerOptions.plugins['vast'] = { url: sampleVast };

        spyOn(DMVAST.client, 'get').and.callThrough();

        player = videojs(playerId, playerOptions, function() {
          this.one('vast-ready', function() {
            expect(DMVAST.client.get).toHaveBeenCalledWith(sampleVast, jasmine.any(Function));
            done();
          });
        });
      });

      it('should request different prerolls when new content is played', function(done) {
        playerOptions.plugins['vast'] = { url: sampleVast };

        spyOn(DMVAST.client, 'get').and.callThrough();

        player = videojs(playerId, playerOptions, function() {
          this.one('vast-ready', function() {
            this.one('vast-ready', function() {
              expect(DMVAST.client.get.calls.allArgs()).toEqual([[sampleVast, jasmine.any(Function)], [sampleVast2, jasmine.any(Function)]]);
              done();
            });

            this.vast.url(sampleVast2);
            this.src(sampleWebm);
          });
        });
      });
    });
  });
}());