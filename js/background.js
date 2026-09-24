'use strict';

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg.type !== 'fetch') {
    sendResponse({ error: 'Unknown message type' });
    return;
  }
  var url = msg.url;
  var options = msg.options || {};
  fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    credentials: options.credentials || 'omit',
  })
    .then(function (res) {
      return res.text().then(function (body) {
        sendResponse({ ok: res.ok, status: res.status, body: body });
      });
    })
    .catch(function (err) {
      sendResponse({ error: String(err && err.message ? err.message : err) });
    });
  return true;
});
