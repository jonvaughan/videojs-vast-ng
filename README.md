videojs-vast-ng
===================

This plugin enables VideoJS to play [VAST](https://www.iab.net/vast) advertisement videos. This plugin is a backend integration on top of the [videojs-contrib-ads](https://github.com/videojs/videojs-contrib-ads) plugin. This codebase was originally inspired by [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).

### Features

- VAST parsing done through through [vast-client](https://github.com/dailymotion/vast-client-js).
- The VAST response can be optionally requested through a Flash XHR to work around AD networks that don't have proper CORS headers implemented with [crossxhr](https://github.com/RobinQu/CrossXHR).
- [VPAID](http://www.iab.net/vpaid) can be supported by including the [videojs-vpaid](https://github.com/pragmaticlabs/videojs-vpaid) plugin.


### Usage:

```html
<script src="http://vjs.zencdn.net/4.12.3/video.js"></script>
<script src="vast-client.js"></script>
<script src="videojs.ads.js"></script>
<script src="videojs.vast.js"></script>
<video
  id="myvideo"
  class="video-js vjs-default-skin"
  src="http://vjs.zencdn.net/v/oceans.mp4"
  width="622"
  height="350">
</video>
<script type="text/javascript">
videojs('myvideo', plugins: {
  ads: {},
  vast: {
    url: 'http://url.to.your/vast/file.xml'
  }
});
</script>
```

Add "ads" and "vast" to the plugins object, and pass a url:

### Options
- url: a URL to the xml file.
- skip: how long until the user can skip the ad. Defaults to 5, and a negative number will disable it.

### Credit
- This codebase was forked from [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).
