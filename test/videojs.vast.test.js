(function (window, document, videojs, expect, assert, spy, match, undefined) {
  'use strict';

  describe('videojs.vast', function() {
    var
      player,
      playerEl,
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

    beforeEach(function() {
      playerEl = document.createElement('video');
      playerEl.setAttribute('id', playerId);
      document.body.appendChild(playerEl);
    });

    describe('Requirements', function() {

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

      it('should play multiple preroll when content updates', function(done) {
        // setTimeout(done, 2000);

        playerOptions.plugins['vast'] = { url: sampleVast, customURLHandler: null };

        var getSpy = spy(DMVAST.client, 'get');

        videojs(playerEl, playerOptions, function() {
          player = this;

          player.one('play', function() {
            player.one('play', function() {
              getSpy.calledWithMatch(sampleVast2, match.func);
              done();
            });

            getSpy.calledWithMatch(sampleVast, match.func);

            player.vast.url(sampleVast2);
            player.src(sampleWebm);
            player.play();
          });

          player.src(sampleMp4);
          player.play();
        });
      });
    });
  });
})(window, document, videojs, chai.expect, chai.assert, sinon.spy, sinon.match);