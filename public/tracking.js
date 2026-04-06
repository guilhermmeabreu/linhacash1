(function () {
  var ENDPOINT = '/api/events';

  function getUserToken() {
    try {
      return localStorage.getItem('lc_token');
    } catch {
      return null;
    }
  }

  function getSessionId() {
    try {
      return localStorage.getItem('lc_session_id');
    } catch {
      return null;
    }
  }

  function safeString(value, fallback) {
    if (typeof value !== 'string') return fallback;
    var trimmed = value.trim();
    return trimmed || fallback;
  }

  function normalizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }
    return metadata;
  }

  function send(payload) {
    try {
      var body = JSON.stringify(payload);
      var token = getUserToken();
      var sessionId = getSessionId();

      if (navigator.sendBeacon && !token) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      }

      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      if (sessionId) headers['X-Session-Id'] = sessionId;

      fetch(ENDPOINT, {
        method: 'POST',
        headers: headers,
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch {}
  }

  function track(eventName, metadata) {
    try {
      var payload = {
        event_name: safeString(eventName, 'unknown_event'),
        metadata: normalizeMetadata(metadata),
      };
      send(payload);
    } catch {}
  }

  window.track = track;
})();
