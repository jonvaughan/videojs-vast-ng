(function (window, document, videojs, expect, assert, spy, match, undefined) {
  'use strict';

  describe('videojs.vast', function() {
    var
      player,
      videoEl,
      sampleVast = 'base/test/vast/sample-vast.xml?id=1',
      sampleVast2 = 'base/test/vast/sample-vast.xml?id=2',
      sampleMp4 = {
        src: 'base/test/media/small.mp4',
        type: 'video/mp4'
      },
      sampleWebm = {
        src: 'base/test/media/small.webm',
        type: 'video/webm'
      },
      playerId = 'vid';


    var playerOptions, vastClientGetSpy;

    beforeEach(function() {
      videoEl = document.createElement('video');
      videoEl.setAttribute('id', playerId);
      document.body.appendChild(videoEl);

      playerOptions = {
        controls: true,
        plugins: {
          'ads': { }
        }
      };

      vastClientGetSpy = spy(DMVAST.client, 'get');
    });

    afterEach(function(done) {
      vastClientGetSpy.restore();
      // setTimeout hack around a .dispose() bug:
      // https://github.com/videojs/video.js/issues/1484
      setTimeout(function() {
        if (player) {
          player.dispose();
          player = null;
        }

        if (videoEl.parentNode) {
          videoEl.parentNode.removeChild(videoEl);
        }

        videoEl = null;

        done();
      }, 100);
    });

    it('should switch preroll when new content updates', function(done) {
      this.timeout(8000);

      playerOptions.plugins['vast'] = { url: sampleVast, customURLHandler: null };

      videojs(videoEl, playerOptions, function() {
        player = this;

        player.one('play', function() {
          player.one('play', function() {
            vastClientGetSpy.calledWithMatch(sampleVast2, match.func);
            done();
          });

          vastClientGetSpy.calledWithMatch(sampleVast, match.func);

          player.vast.url(sampleVast2);
          player.src(sampleWebm);
          player.play();
        });

        player.src(sampleMp4);
        player.play();
      });
    });

    it('should play a preroll AD before playing the content', function(done) {
      this.timeout(20000);

      playerOptions.plugins['vast'] = { url: sampleVast, customURLHandler: null };

      videojs(videoEl, playerOptions, function() {
        player = this;

        player.one('adstart', function() {
          player.one('adend', function() {
            done();
          });
        });

        player.src(sampleMp4);
        player.play();
      });
    });
  });
})(window, document, videojs, chai.expect, chai.assert, sinon.spy, sinon.match);