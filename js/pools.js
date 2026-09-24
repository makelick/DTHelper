'use strict';

function mergePools(geckoPools, dexscreenerPools) {
  const byKey = new Map();
  for (const p of geckoPools) {
    const key = `${p.pair}|${p.dex}`;
    const copy = { ...p, sources: p.sources || [p.source] };
    if (!byKey.has(key) || byKey.get(key).liquidityUsd < p.liquidityUsd) byKey.set(key, copy);
  }
  for (const p of dexscreenerPools) {
    const key = `${p.pair}|${p.dex}`;
    const existing = byKey.get(key);
    const sources = p.sources || [p.source || 'dexscreener'];
    if (!existing) byKey.set(key, { ...p, sources });
    else {
      const merged = { ...existing, liquidityUsd: Math.max(existing.liquidityUsd, p.liquidityUsd) };
      merged.sources = [...new Set([...(existing.sources || [existing.source]), ...sources])];
      merged.geckoUrl = merged.geckoUrl || p.geckoUrl || null;
      merged.dexUrl = merged.dexUrl || p.dexUrl || null;
      merged.volume24h = Math.max(existing.volume24h || 0, p.volume24h || 0);
      if ((p.buys24h || 0) + (p.sells24h || 0) > (existing.buys24h || 0) + (existing.sells24h || 0)) {
        merged.buys24h = p.buys24h || 0;
        merged.sells24h = p.sells24h || 0;
      }
      if (p.baseAmount !== '—' || p.quoteAmount !== '—') {
        merged.baseAmount = p.baseAmount;
        merged.quoteAmount = p.quoteAmount;
        merged.baseSymbol = p.baseSymbol;
        merged.quoteSymbol = p.quoteSymbol;
        merged.baseAddress = p.baseAddress || merged.baseAddress;
        merged.quoteAddress = p.quoteAddress || merged.quoteAddress;
      }
      byKey.set(key, merged);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, MAX_POOLS);
}

const geckoInvalidCache = new Map();

async function checkGeckoPoolPageReachable(url) {
  if (!url || typeof url !== 'string') return true;
  const cached = geckoInvalidCache.get(url);
  if (cached !== undefined) return !cached;
  try {
    const res = await extensionFetch(url, { method: 'HEAD' });
    const invalid = !res.ok;
    geckoInvalidCache.set(url, invalid);
    return !invalid;
  } catch (_) {
    geckoInvalidCache.set(url, true);
    return false;
  }
}

function applyGeckoInvalidCache(pools) {
  const uncached = [];
  const seen = new Set();
  for (const p of pools) {
    if (!p.geckoUrl) continue;
    const invalid = geckoInvalidCache.get(p.geckoUrl);
    if (invalid === true) p.geckoInvalid = true;
    else if (invalid === undefined && !seen.has(p.geckoUrl)) {
      seen.add(p.geckoUrl);
      uncached.push(p.geckoUrl);
    }
  }
  return uncached;
}

function runBackgroundGeckoValidation(uncachedUrls) {
  if (!uncachedUrls.length) return;
  const panel = document.getElementById(POOL_ID);
  if (!panel) return;
  uncachedUrls.forEach(function (url) {
    checkGeckoPoolPageReachable(url).then(function (ok) {
      if (ok) return;
      var rows = panel.querySelectorAll('tr[data-gecko-url]');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].dataset.geckoUrl !== url) continue;
        var cell = rows[i].querySelector('.dthelper-src-cell');
        if (!cell || cell.querySelector('.dthelper-src-invalid')) continue;
        var span = document.createElement('span');
        span.className = 'dthelper-src-invalid';
        span.title = 'Pool page not found on GeckoTerminal';
        span.textContent = '❌';
        var after = cell.querySelector('.dthelper-src-gt, .dthelper-src');
        if (after && after.nextSibling) cell.insertBefore(span, after.nextSibling);
        else if (after) after.insertAdjacentElement('afterend', span);
        else cell.appendChild(span);
      }
    });
  });
}
