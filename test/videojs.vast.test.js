(function (window, document, videojs, DMVAST, chai, sinon) {
  'use strict';

  var expect = chai.expect;
  var assert = chai.assert;
  var spy = sinon.spy;
  var match = sinon.match;
  var fakeServer = sinon.fakeServer;

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
    localhostMediaFileNotFoundVast = 'base/test/vast/localhost-mediafile-notfound.xml',
    emptyVast = 'base/test/vast/empty-vast.xml',
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
      eventTrackerServer = fakeServer.create();
      eventTrackerServer.xhr.useFilters = true;
      eventTrackerServer.xhr.addFilter(function (method, url) {
        var isTracking = !!url.match(/^http\:\/\/localhost\:9876\/tracking/);
        // console.info(method, url, isTracking);
        return !isTracking;
      });

      // TODO: vast-client makes tracking requests through creating
      // Image objects in javascript. How to test this?
      // eventTrackerServer.respondWith('GET', 'http://localhost:9876/tracking/start');
      // eventTrackerServer.respondWith('GET', 'http://localhost:9876/tracking/pause');
      // eventTrackerServer.respondWith('GET', 'http://localhost:9876/tracking/firstQuartile');
      // eventTrackerServer.respondWith('GET', 'http://localhost:9876/tracking/midpoint');
      // eventTrackerServer.respondWith('GET', 'http://localhost:9876/tracking/thirdQuartile');
      // eventTrackerServer.respondWith('GET', 'http://localhost:9876/tracking/pause');
      // eventTrackerServer.respondWith('GET', 'http://localhost:9876/tracking/complete');

      windowOpenSpy = spy(window, 'open');
      vastClientGetSpy = spy(DMVAST.client, 'get');
      trackSpy = spy(DMVAST.util, 'track');

      videoEl = document.createElement('video');
      videoEl.setAttribute('id', playerId);
      document.body.appendChild(videoEl);

      playerOptions = {
        controls: true,
        muted: true,
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
        }

        if (videoEl.parentNode) {
          videoEl.parentNode.removeChild(videoEl);
        }

        player = null;
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

          player.src(sampleMp4);
          player.play();
        });
      });

    }); // end describe

    describe('with good VAST tags', function() {

      it('should switch to new preroll when new content updates', function(done) {
        this.timeout(2000);

        playerOptions.plugins['vast'] = {
          debug: true,
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
                vastClientGetSpy.should.have.been.calledWithMatch(
                  match(String.prototype.startsWith, localhostMp4Vast),
                  match.object,
                  match.func);
              } catch(e) {
                done(e);
              }

              player.one('adstart', function() {
                try {
                  vastClientGetSpy.should.have.been.calledWith(
                    match(String.prototype.startsWith, localhostMp4Vast2),
                    match.object,
                    match.func);
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
              }, 100);
            }, 0);
          });

          player.src(sampleMp4);
          player.play();
        });
      });

      it('should play a preroll should fire the proper sequence of VAST events', function(done) {
        var test = this;
        test.timeout(15000);

        playerOptions.plugins['vast'] = {
          url: localhostMp4Vast,
          customURLHandler: null,
          vastTimeout: 1000
        };

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
              try {
                expect(player.paused()).to.equal(false);
              } catch(e) {
                done(e);
              }
              player.trigger('click');
            }, 500); // end setTimeout

          }); // end adstart

          // a click event should pause the player and bring up a popup
          player.one('pause', function() {
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

          player.one('contentplayback', function() {
            setTimeout(function() {
              // confirm tracking events
              // expect(trackSpy).to.have.been.calledWith(['http://localhost:9876/tracking/start']);
              // expect(trackSpy).to.have.been.calledWith(['http://localhost:9876/tracking/firstQuartile']);
              // expect(trackSpy).to.have.been.calledWith(['http://localhost:9876/tracking/midpoint']);
              // expect(trackSpy).to.have.been.calledWith(['http://localhost:9876/tracking/thirdQuartile']);
              // expect(trackSpy).to.have.been.calledWith(['http://localhost:9876/tracking/complete']);

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

    // describe('with timeouts', function() {
    // });

    describe('with bad VAST tags', function() {

      it('should skip a preroll and play content if the VAST response is empty', function(done) {
        this.timeout(3000);

        playerOptions.plugins['vast'] = {
          url: emptyVast,
          customURLHandler: null,
          vastTimeout: 1000
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.one(['adscanceled', 'adserror'], function() {
            player.one('contentplayback', function() {
              expect(player.src()).to.match(/test\/media\/small\.mp4$/);
              expect(player.paused()).to.equal(false);
              done();
            });
          });

          player.one('adstart', function() {
            done('the ad should not have played!');
          });

          player.src(sampleMp4);
          player.play();
        });
      });

      it('should skip a preroll and play content if the media file returns HTTP 404 not found', function(done) {
        this.timeout(3000);

        playerOptions.plugins['vast'] = {
          url: localhostMediaFileNotFoundVast,
          customURLHandler: null,
          vastTimeout: 1000
        };

        videojs(videoEl, playerOptions, function() {
          player = this;

          player.one('error', function() {
            player.one(['contentplay', 'contentplayback'], function(e) {
              expect(player.src()).to.match(/test\/media\/small\.mp4$/);
              expect(player.paused()).to.equal(false);
              done();
            });
          });

          setTimeout(function() {
            player.src(sampleMp4);
            player.play();
          });
        });
      });

    }); // end describe
  });
})(window, document, videojs, DMVAST, chai, sinon);