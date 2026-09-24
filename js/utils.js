'use strict';

function getDebugFlag() {
  return new Promise(function (resolve) {
    try {
      chrome.storage.local.get([STORAGE_DEBUG], function (r) { resolve(r[STORAGE_DEBUG] !== false); });
    } catch (_) {
      resolve(true);
    }
  });
}

function debugLog(enable, label, data) {
  if (!enable) return;
  try {
    console.log('[DTHelper]', label, data !== undefined ? data : '');
  } catch (_) { }
}

function logError(label, message, err, url, status) {
  try {
    var parts = ['[DTHelper]', label, message];
    if (url) parts.push('URL=' + (url.length > 80 ? url.slice(0, 77) + '…' : url));
    if (status) parts.push('status=' + status);
    if (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        parts.push('(network/CORS error)');
      } else if (err.stack) {
        parts.push('stack=' + err.stack.split('\n')[0]);
      } else {
        parts.push('error=' + String(err));
      }
    }
    console.log(parts.join(' '));
  } catch (_) { }
}

function toHumanDex(dexId) {
  if (!dexId) return '—';
  const lower = String(dexId).toLowerCase();
  return DEX_NAMES[lower] || lower.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function normAddr(id) {
  if (!id) return '';
  const s = String(id);
  const i = s.indexOf('_');
  return i >= 0 ? s.slice(i + 1).toLowerCase() : s.toLowerCase();
}

function formatNumber(n) {
  const x = typeof n === 'number' ? n : parseFloat(n);
  if (Number.isNaN(x)) return '—';
  if (x >= 1e9) return (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(2) + 'K';
  return x.toFixed(2);
}

function formatUsd(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
  return '$' + Math.round(n);
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
