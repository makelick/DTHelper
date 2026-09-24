'use strict';

function getShowCardDefault(cb) {
  try {
    chrome.storage.local.get([STORAGE_SHOW_CARD], function (r) {
      cb(r[STORAGE_SHOW_CARD] !== false);
    });
  } catch (err) {
    cb(true);
  }
}

function getExpandedDefault(cb) {
  try {
    chrome.storage.local.get([STORAGE_EXPANDED], function (r) {
      cb(r[STORAGE_EXPANDED] !== false);
    });
  } catch (err) {
    cb(true);
  }
}

async function loadAndShowPools(ctx) {
  const { address, config } = ctx;
  const chainTheme = config.theme || 'default';
  const host = window.location.hostname || '';
  const debug = await getDebugFlag().catch(function () { return false; });
  const t0 = performance.now();
  debugLog(debug, 'start', { host: host, token: address ? address.slice(0, 10) + '…' : '—' });

  getExpandedDefault(function (expanded) {
    const startCollapsed = !expanded;
    const container = createPanelElement([], true, null, address, chainTheme, startCollapsed);
    injectPanel(container);
  });

  let geckoPools = [];
  let dexscreenerPools = [];
  let error = null;
  var gtMs = 0;
  var dxMs = 0;
  var gtFailed = false;
  var dxFailed = false;

  var gtPromise = config.geckoNetwork
    ? (function () {
      var start = performance.now();
      return fetchGeckoTerminalPools(config.geckoNetwork, address)
        .then(function (pools) {
          gtMs = Math.round(performance.now() - start);
          debugLog(debug, 'GeckoTerminal', gtMs + 'ms, pools=' + (Array.isArray(pools) ? pools.length : 0));
          return Array.isArray(pools) ? pools : [];
        })
        .catch(function (e) {
          gtMs = Math.round(performance.now() - start);
          gtFailed = true;
          logError('GeckoTerminal', e && e.message ? e.message : 'Failed to fetch', e, 'fetchGeckoTerminalPools');
          return [];
        });
    })()
    : Promise.resolve([]);

  var dxPromise = (function () {
    var start = performance.now();
    return fetchDexscreenerPools(config.dexscreenerChainId, address)
      .then(function (pools) {
        dxMs = Math.round(performance.now() - start);
        debugLog(debug, 'Dexscreener', dxMs + 'ms, pools=' + (Array.isArray(pools) ? pools.length : 0));
        return Array.isArray(pools) ? pools : [];
      })
      .catch(function (e) {
        dxMs = Math.round(performance.now() - start);
        dxFailed = true;
        logError('Dexscreener', e && e.message ? e.message : 'Failed to fetch', e, 'fetchDexscreenerPools');
        return [];
      });
  })();

  try {
    var results = await Promise.all([gtPromise, dxPromise]);
    geckoPools = results[0] || [];
    dexscreenerPools = results[1] || [];
    if ((gtFailed || dxFailed) && !geckoPools.length && !dexscreenerPools.length) {
      error = 'Failed to load pool data';
    }
  } catch (e) {
    error = e && e.message ? e.message : 'Failed to load pool data';
    logError('loadAndShowPools', error, e);
  }

  var totalMs = Math.round(performance.now() - t0);
  var merged = mergePools(geckoPools, dexscreenerPools);
  var hasError = !!(gtFailed || dxFailed || error);
  if (debug || hasError) {
    var report = 'host=' + host + ' token=' + (address ? address.slice(0, 12) + '…' : '—') + ' gtMs=' + gtMs + ' dxMs=' + dxMs + ' totalMs=' + totalMs + ' pools=' + merged.length + (error ? ' error=' + String(error).replace(/\s+/g, ' ') : '');
    console.log('[DTHelper] Report (copy for bug report):', report);
  }

  const uncachedGeckoUrls = applyGeckoInvalidCache(merged);
  getExpandedDefault(function (expanded) {
    const startCollapsed = !expanded;
    const newPanel = createPanelElement(merged, false, error, address, chainTheme, startCollapsed);
    injectPanel(newPanel);
    runBackgroundGeckoValidation(uncachedGeckoUrls);
  });
}

async function loadAndShowHoneypot(ctx) {
  const { address, config } = ctx;
  if (!config.honeypotChainId) return;
  const chainTheme = config.theme || 'default';
  const honeypotUrl = 'https://honeypot.is/' + (config.honeypotPath || '') + '?address=' + encodeURIComponent(address);
  injectHoneypotPanel(createHoneypotPanelElement(null, true, null, chainTheme, honeypotUrl));
  let result = null;
  let error = null;
  try {
    result = await fetchHoneypot(config.honeypotChainId, address);
  } catch (e) {
    error = e && e.message && e.message !== 'Failed to fetch' ? e.message : 'Failed to load honeypot.is data';
    logError('Honeypot', error, e, 'fetchHoneypot');
  }
  injectHoneypotPanel(createHoneypotPanelElement(result, false, error, chainTheme, honeypotUrl));
}

function removeInjectedPanel() {
  var wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) wrapper.remove();
}

function run() {
  var txCtx = typeof getTxPageContext !== 'undefined' ? getTxPageContext() : null;
  if (txCtx) {
    runTxPage(txCtx);
    return;
  }
  getShowCardDefault(function (showCard) {
    if (!showCard) return;
    const ctx = getTokenPageContext();
    if (!ctx) {
      removeInjectedPanel();
      return;
    }
    ensureInsertionPoint(function () {
      loadAndShowPools(ctx);
      loadAndShowHoneypot(ctx);
    });
  });
}

function setupSpaNavigationListener() {
  if (getSiteFamily() !== 'solscan') return;
  var lastPath = getNormalizedPathname();
  function onRouteChange() {
    var current = getNormalizedPathname();
    if (current === lastPath) return;
    lastPath = current;
    run();
  }
  var _pushState = history.pushState;
  var _replaceState = history.replaceState;
  history.pushState = function () {
    _pushState.apply(this, arguments);
    onRouteChange();
  };
  history.replaceState = function () {
    _replaceState.apply(this, arguments);
    onRouteChange();
  };
  window.addEventListener('popstate', onRouteChange);
  setInterval(onRouteChange, 800);
}

function runTxPage(txCtx) {
  function tryInject(attempts) {
    attempts = attempts || 0;
    var point = findTxHashInsertionPoint();
    if (point) {
      var section = createSearchAtSection(txCtx.txHash);
      if (section) point.refEl.insertAdjacentElement(point.position, section);
      return;
    }
    if (attempts >= 20) return;
    setTimeout(function () { tryInject(attempts + 1); }, 250);
  }
  tryInject(0);
}

if (typeof getTokenPageContext !== 'undefined' || typeof getTxPageContext !== 'undefined') {
  run();
  setupSpaNavigationListener();
}
