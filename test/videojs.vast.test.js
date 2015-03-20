(function (window, document, videojs, expect, assert, spy, match, undefined) {
  'use strict';

  var
    localhostMp4Vast = 'base/test/vast/localhost-mp4.xml?id=1',
    localhostMp4Vast2 = 'base/test/vast/localhost-mp4.xml?id=2',
    localhostMediaFileNotFoundVast = 'base/test/vast/localhost-mediafile-notfound',
    sampleMp4 = {
      src: 'base/test/media/small.mp4',
      type: 'video/mp4'
    },
    sampleWebm = {
      src: 'base/test/media/small.webm',
      type: 'video/webm'
    },
    playerId = 'vid';

  describe('videojs.vast', function() {
    var
      player,
      videoEl;

    var playerOptions, vastClientGetSpy;

    beforeEach(function() {
      vastClientGetSpy = spy(DMVAST.client, 'get');

      videoEl = document.createElement('video');
      videoEl.setAttribute('id', playerId);
      document.body.appendChild(videoEl);

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

        if (videoEl.parentNode) {
          videoEl.parentNode.removeChild(videoEl);
        }

        videoEl = null;

        vastClientGetSpy.restore();

        done();
      }, 100);
    });

    describe('with good VAST tags', function() {

      it('should switch preroll when new content updates', function(done) {
        this.timeout(2000);

        playerOptions.plugins['vast'] = {
          url: localhostMp4Vast,
          customURLHandler: null
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.one(['adscanceled', 'adserror'], function() {
            done('adscanceled or adserror triggered');
          });

          player.one('play', function() {
            player.one('play', function() {
              vastClientGetSpy.calledWithMatch(localhostMp4Vast2, match.func);
              done();
            });

            vastClientGetSpy.calledWithMatch(localhostMp4Vast, match.func);

            player.vast.url(localhostMp4Vast2);
            player.src(sampleWebm);
            player.play();
          });

          player.src(sampleMp4);
          player.play();
        });
      });

      it('should play a preroll request from start to finish and fire the proper VAST events', function(done) {
        this.timeout(12000);

        playerOptions.plugins['vast'] = {
          url: localhostMp4Vast,
          customURLHandler: null,
          vastTimeout: 1000
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.one(['adscanceled', 'adserror'], function() {
            done('adscanceled or adserror triggered');
          });

          player.one('adsready', function() {
            player.one('vastrequested', function() {
              player.one('adstart', function() {
                player.one('play', function() {
                  player.one('adend', function() {
                    player.one('play', function() {
                      expect(player.src()).to.match(/test\/media\/small\.mp4$/);
                      done();
                    });
                  });
                  expect(player.src()).to.match(/test\/media\/H264_test8_voiceclip_mp4_480x320\.mp4$/);
                });
              });
            });
          });

          player.src(sampleMp4);
          player.play();
        });
      });

      it('should cancel playing a preroll if no AD tag URL is provided on initialization', function(done) {
        this.timeout(2000);

        playerOptions.plugins['vast'] = {
          customURLHandler: null,
          vastTimeout: 1000
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.one('adserror', function() {
            done('adserror triggered');
          });

          player.one('adscanceled', function() {
            done();
          });

          player.one('adsready', function() {
            done();
          });

          player.src(sampleMp4);
          player.play();
        });
      });

    }); // end describe

    describe('with bad VAST tags', function() {

      it('should gracefully skip a preroll and play content if the media file is not found', function(done) {
        this.timeout(12000);

        playerOptions.plugins['vast'] = {
          url: localhostMediaFileNotFoundVast,
          customURLHandler: null,
          vastTimeout: 1000
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.one(['adscanceled', 'adserror'], function() {
            player.one('play', function() {
              expect(player.src()).to.match(/test\/media\/small\.mp4$/);
              done();
            });
          });

          player.one('adsready', function() {
            player.one('vastrequested', function() {
              player.one('adstart', function() {
                done('the ad should not have played!');
              });
            });
          });

          player.src(sampleMp4);
          player.play();
        });
      });

    }); // end describe
  });
})(window, document, videojs, chai.expect, chai.assert, sinon.spy, sinon.match);