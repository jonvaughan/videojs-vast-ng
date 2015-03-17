(function(window, videojs, CrossXHR, undefined) {
  'use strict';
  var _parseXml;

  if (window.DOMParser) {
    _parseXml = function(xmlStr) {
      return ( new window.DOMParser() ).parseFromString(xmlStr, 'text/xml');
    };
  } else if (typeof window.ActiveXObject !== 'undefined' && new window.ActiveXObject('Microsoft.XMLDOM')) {
    _parseXml = function(xmlStr) {
      var xmlDoc = new window.ActiveXObject('Microsoft.XMLDOM');
      xmlDoc.async = 'false';
      xmlDoc.loadXML(xmlStr);
      return xmlDoc;
    };
  } else {
    _parseXml = function() { return null; };
  }

  // custom url handler for requesting VAST tags to bypass CORS problems
  videojs.SwfURLHandler = function(options) {
    return {
      supported: function() {
        return CrossXHR && videojs.Flash.isSupported();
      },

      get: function(url, options, cb) {
        try {
          var xhr = new CrossXHR();
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              var xml = _parseXml(xhr.responseText);
              if (options.debug) { videojs.log('swfurlhandler', 'response', xml); }
              cb(null, xml);
            }
          };
          if (options.debug) { videojs.log('request to ' + url); }
          xhr.open('GET', url);
          xhr.send();
        } catch(e) {
          videojs.log.warn(e);
          cb();
        }
      }
    };
  };
})(window, videojs, CrossXHR);