# videojs-vast-ng
This plugin enables VideoJS to play [VAST](https://www.iab.net/vast) advertisement videos. This plugin is a backend integration on top of the [videojs-contrib-ads](https://github.com/videojs/videojs-contrib-ads) plugin. This codebase was originally inspired by [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).

## Features
- VAST 2.0 support and partial VAST 3.0 support
- AD Pod support
- Multiple companion banner support
- Custom Flash-based XMLHttpRequest support to work around AD servers that lack CORS configuration

## Usage
```html
<script src="http://vjs.zencdn.net/4.12.3/video.js"></script>
<script src="vast-client.js"></script>
<script src="videojs.ads.js"></script>
<script src="videojs.vast.js"></script>

<!-- video player -->
<video
  id="myvideo"
  class="video-js vjs-default-skin"
  src="http://vjs.zencdn.net/v/oceans.mp4"
  width="622"
  height="350">
</video>

<!-- 300 x 200 companion banner -->
<div id="myvideo-300x250"></div>

<script type="text/javascript">
videojs('myvideo', plugins: {
  ads: {},
  vast: {
    url: 'http://url.to.your/vast/file.xml'
  }
});
</script>
```

## Options
- `url` (required): a URL to the xml file.
- `skip` (default: 5): how long until the user can skip the ad. Defaults to 5, and a negative number will disable it.
- `customURLHandler` (default: Object): The default enable Flash-based XMLHttpRequest when requesting a VAST response.
  Set this value to `false` to disable.
- `maxAdAttempts` (default: 1): Max number of attempts at playing an AD at any given AD break.
- `maxAdCount` (default: 1): Max number of ADs to play at any given AD break.
- `adParameters` (default: {}): A key-value map to be converted into querystring parameters to be appended onto the
  request to the AD server for the VAST response.

## VPAID Support
[VPAID](http://www.iab.net/vpaid) can be supported by including the [videojs-vpaid](https://github.com/pragmaticlabs/videojs-vpaid) plugin.

## Credit
- This codebase was forked from [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).
- VAST parsing support through [vast-client](https://github.com/dailymotion/vast-client-js).
- Flash-based XMLHttpRequest support through [crossxhr](https://github.com/RobinQu/CrossXHR).
