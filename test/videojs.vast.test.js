(function (window, document, videojs, expect, assert, spy, match, undefined) {
  'use strict';

  if (!String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: function(searchString, position) {
        position = position || 0;
        return this.lastIndexOf(searchString, position) === position;
      }
    });
  }

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
      playerOptions,
      player,
      videoEl,
      windowOpenSpy,
      vastClientGetSpy,
      trackSpy,
      eventTrackerServer;

    beforeEach(function() {
      eventTrackerServer = sinon.fakeServer.create();
      eventTrackerServer.xhr.useFilters = true;
      eventTrackerServer.xhr.addFilter(function (method, url) {
        return !url.match(/^http\:\/\/localhost\:9876\/tracking/);
      });

      windowOpenSpy = spy(window, 'open');
      vastClientGetSpy = spy(DMVAST.client, 'get');
      trackSpy = spy(DMVAST.util, 'track');

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

        trackSpy.restore();
        vastClientGetSpy.restore();
        windowOpenSpy.restore();
        eventTrackerServer.restore();

        done();
      }, 100);
    });

    describe('with no VAST tag', function() {

      it('should cancel playing a preroll on plugin init', function(done) {
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

    describe('with good VAST tags', function() {

      it('should switch to new preroll when new content updates', function(done) {
        this.timeout(1000);

        playerOptions.plugins['vast'] = {
          url: localhostMp4Vast,
          customURLHandler: null
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.one(['adscanceled', 'adserror'], function() {
            done('adscanceled or adserror triggered');
          });

          player.one('adstart', function() {

            // wait so that the player transitions over to 'ad-playback'
            setTimeout(function() {
              try {
                expect(player.ads.state).to.equal('ad-playback');
                expect(vastClientGetSpy.calledWith(
                  match(String.prototype.startsWith, localhostMp4Vast),
                  match.object,
                  match.func)).to.equal(true);
              } catch(e) {
                done(e);
              }

              player.one('adstart', function() {
                try {
                  expect(vastClientGetSpy.calledWith(
                    match(String.prototype.startsWith, localhostMp4Vast2),
                    match.object,
                    match.func)).to.equal(true);
                  done();
                } catch(e) {
                  done(e.message);
                }
              });

              // this must be triggered to transition the player out of 'ad-playback'
              player.trigger('adend');

              // wait for 'adend' to transition the player to 'content-playback'
              setTimeout(function() {
                player.vast.url(localhostMp4Vast2);
                player.src(sampleWebm);
                player.play();
              }, 200);
            }, 0);
          });

          player.src(sampleMp4);
          player.play();
        });
      });

      it('should play a preroll should fire the proper VAST events', function(done) {
        var test = this;
        test.timeout(15000);

        playerOptions.plugins['vast'] = {
          url: localhostMp4Vast,
          customURLHandler: null,
          vastTimeout: 1000
        };

        playerOptions.debug = true;
        playerOptions.plugins.ads.debug = true;
        playerOptions.plugins.vast.debug = true;

        var eventCount = {};

        var eventHandler = function(e) {
          expect(e).to.have.property('type');

          if (eventCount[e.type] === undefined) {
            eventCount[e.type] = 1;
          } else {
            eventCount[e.type]++;
          }
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.on([
            'play',
            'vastrequesting',
            'adsready',
            'adstart',
            'pause',
            'adend',
            'click'
          ], eventHandler);

          player.one(['adscanceled', 'adserror'], function() {
            done('adscanceled or adserror triggered');
          });

          player.one('adstart', function() {

            setTimeout(function() {
              console.log('====> CLICKED');
              try {
                expect(player.paused()).to.equal(false);
              } catch(e) {
                done(e);
              }
              player.trigger('click');
            }, 500); // end setTimeout

          }); // end adstart

          player.on('play', function() {
            console.log('====> PLAY', player.ads.state);
          });

          // a click event should pause the player and bring up a popup
          player.one('pause', function() {

            console.log('====> PAUSED');

            setTimeout(function() {

              // assert only 1 window was opened
              try {
                expect(windowOpenSpy.returnValues.length).to.equal(1);
              } catch(e) {
                done(e);
              }
              windowOpenSpy.returnValues[0].close();

              // assert a new window is opened when the AD is clicked
              assert(windowOpenSpy.calledWithExactly('http://localhost:9876/clickThrough', '_blank'));

              // assert we are resuming the same video
              expect(player.src()).to.match(/test\/media\/H264_test8_voiceclip_mp4_480x320\.mp4$/);
              player.play();

            }, 1000); // end setTimeout

          }); // end pause

          player.on('adend', function() {
            console.log('====> ADEND', eventCount['adend']);
          });

          player.one('contentplayback', function() {
            console.log('====> contentplayback');
            setTimeout(function() {
              // confirm tracking events
              expect(trackSpy.callCount).to.equal(8);

              // assert(trackSpy.getCall(0).calledWith(['http://localhost:9876/tracking/pause']));
              // assert(trackSpy.getCall(1).calledWith(['http://localhost:9876/tracking/start']));
              // assert(trackSpy.getCall(2).calledWith(['http://localhost:9876/tracking/firstQuartile']));
              // assert(trackSpy.getCall(3).calledWith(['http://localhost:9876/tracking/midpoint']));
              // assert(trackSpy.getCall(4).calledWith(['http://localhost:9876/tracking/thirdQuartile']));
              // assert(trackSpy.getCall(5).calledWith(['http://localhost:9876/tracking/pause']));
              // assert(trackSpy.getCall(6).calledWith(['http://localhost:9876/tracking/complete']));

              // assert the player has now transitioned to the content
              expect(player.src()).to.match(/test\/media\/small\.mp4$/);
              done();
            }, 100);
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