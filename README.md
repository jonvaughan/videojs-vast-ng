videojs-vast-ng
===================

This plugin enables VideoJS to play [VAST](https://www.iab.net/vast) advertisement videos. This plugin is a concrete implementation on top of the [videojs-contrib-ads](https://github.com/videojs/videojs-contrib-ads) plugin. This codebase was originally inspired by [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).

### Usage
Include the plugin and it's dependencies:

```html
<script src="http://vjs.zencdn.net/4.12.3/video.js"></script>
<script src="vast-client.js"></script>
<script src="video.ads.js"></script>
<script src="videojs.vast.js"></script>
```

Add "ads" and "vast" to the plugins object, and pass a url:

```js
plugins: {
  ads: {},
  vast: {
    url: 'http://url.to.your/vast/file.xml'
  }
}
```

### Options
- url: a URL to the xml file.
- skip: how long until the user can skip the ad. Defaults to 5, and a negative number will disable it.

### Credit
- VAST file parsing is done by Dailymotion's [vast-client](https://github.com/dailymotion/vast-client-js).
- This codebase was forked from [videojs-vast-plugin](https://github.com/theonion/videojs-vast-plugin).