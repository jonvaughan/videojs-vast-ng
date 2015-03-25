(function(window, videojs, undefined) {
  'use strict';
  videojs.util.param = function(obj) {
    var str = [], key;
    for(key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
      }
    }
    return str.join('&');
  };

  videojs.util.isEmptyObject = function(obj) {
    var key;
    for (key in obj) {
      return false;
    }
    return true;
  };
})(window, videojs);