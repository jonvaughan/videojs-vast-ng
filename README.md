# videojs-vast-ng
This plugin enables VideoJS to play [VAST](https://www.iab.net/vast) advertisement videos. This plugin is a backend integration on top of the [videojs-contrib-ads](https://github.com/videojs/videojs-contrib-ads) plugin. This codebase was originally inspired by [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).

## Features
- VAST 2.0 support and partial VAST 3.0 support
- Preroll support
- Multiple companion banner support
- Multiple ADs per AD break
- Multiple retries per AD break
- Linear [VPAID](http://www.iab.net/vpaid) support
- Custom Flash-based XMLHttpRequest support to work around AD servers that lack CORS configuration

## Development
```bash
$ npm install
$ bower install
$ grunt curl-test-files     # downloads test assets
$ grunt dev                 # local continuous testing
```

## Usage
```html
<script src="http://vjs.zencdn.net/4.12.3/video.js" type="text/javascript"></script>
<script src="vast-client.js" type="text/javascript"></script>
<script src="videojs.ads.js" type="text/javascript"></script>
<script src="videojs.vast.js" type="text/javascript"></script>
<script src="videojs.vpaidjs.js" type="text/javascript"></script>
<script src="videojs.vpaidflash.js" type="text/javascript"></script>

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
videojs('myvideo', {
  techOrder: ['html5', 'flash', 'vpaidjs', 'vpaidflash'],
  src: [
    { src: 'test/media/small.mp4', type: 'video/mp4' },
    { src: 'test/media/small.webm', type: 'video/webm' }
  ],
  plugins: {
    ads: {},
    vast: {
      url: 'http://url.to.your/vast/file.xml'
    }
  }
});
</script>
```

## Vast Plugin Options
- `url` (required): a URL to the xml file.
- `skip` (default: 5): how long until the user can skip the ad. Defaults to 5, and a negative number will disable it.
- `customURLHandler` (default: Object): The default enable Flash-based XMLHttpRequest when requesting a VAST response.
  Set this value to `false` to disable.
- `maxAdAttempts` (default: 1): Max number of attempts at playing an AD at any given AD break.
- `maxAdCount` (default: 1): Max number of ADs to play at any given AD break.
- `adParameters` (default: {}): A key-value map to be converted into querystring parameters to be appended onto the
  request to the AD server for the VAST response.

## Javascript VPAID Media Tech Options
- `debug` (default: false)
- `viewMode` (default: 'normal')
- `bitrate` (default: 1000)

## Flash VPAID Media Tech Options

## Roadmap

- Midroll support
- Postroll support
- VAST 3 AD pod support
- VMAP support

## Credit
- This codebase was forked from [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).
- VAST parsing support through [vast-client](https://github.com/dailymotion/vast-client-js).
- Flash-based XMLHttpRequest support through [crossxhr](https://github.com/RobinQu/CrossXHR).
