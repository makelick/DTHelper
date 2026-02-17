(function () {
  'use strict';

  const Gecko_BASE = 'https://api.geckoterminal.com/api/v2';
  const DEXSCREENER_BASE = 'https://api.dexscreener.com';
  const Gecko_FAVICON = 'https://www.geckoterminal.com/favicon.ico';
  const DEXSCREENER_FAVICON = 'https://dexscreener.com/favicon.ico';
  const MAX_POOLS = 5;
  const POOL_ID = 'dthelper-liquidity-panel';
  const STORAGE_DEBUG = 'dthelperDebug';

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
      console.warn.apply(console, parts);
    } catch (_) { }
  }

  const DEX_NAMES = {
    'uniswap_v2': 'Uniswap V2',
    'uniswap_v3': 'Uniswap V3',
    'uniswap-v2': 'Uniswap V2',
    'uniswap-v3': 'Uniswap V3',
    'uniswap-v4-ethereum': 'Uniswap V4',
    'uniswap-v4': 'Uniswap V4',
    'curve': 'Curve',
    'curve-dex': 'Curve',
    'pancakeswap_v2': 'PancakeSwap V2',
    'pancakeswap_v3': 'PancakeSwap V3',
    'pancakeswap-v2': 'PancakeSwap V2',
    'pancakeswap-v3': 'PancakeSwap V3',
    'raydium': 'Raydium',
    'raydium-amm': 'Raydium',
    'raydium-clmm': 'Raydium CLMM',
    'orca': 'Orca',
    'camelot-v3': 'Camelot V3',
    'camelot-v2': 'Camelot V2',
    'aerodrome': 'Aerodrome',
    'base-swap': 'BaseSwap',
    'sushiswap': 'SushiSwap',
    'kyberswap': 'KyberSwap',
    'balancer': 'Balancer',
    'velodrome': 'Velodrome',
    'trader-joe': 'Trader Joe',
    'quickswap': 'QuickSwap',
    'gm': 'GM',
  };

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

  /**
   * Fetch top pools for a token from GeckoTerminal. Uses list endpoint then individual multi-pool
   * requests (one per pool) with include_composition=true to get real reserve amounts.
   * 
   * API CALLS PER TOKEN PAGE (optimized with batch + fallback):
   * - 1 list call: /networks/{network}/tokens/{token}/pools
   * - 1 batch multi call: /networks/{network}/pools/multi/{addr1,addr2,...}?include_composition=true
   * - Up to 5 individual multi calls (fallback if batch fails/omits pools)
   * - Best case: 2 calls (list + batch succeeds for all pools)
   * - Worst case: 6 calls (list + batch fails + 5 individual)
   * 
   * RATE LIMIT IMPACT (Public API: 30 calls/minute per https://apiguide.geckoterminal.com/faq):
   * - Best case: ~15 token pages/minute (30 / 2 = 15), ~4 seconds between pages
   * - Worst case: ~5 token pages/minute (30 / 6 = 5), ~12 seconds between pages
   * - Typical: ~10 token pages/minute (30 / 3 avg = 10), ~6 seconds between pages
   * - If users open tokens faster, they'll hit rate limits and see "Failed to fetch" errors
   * 
   * @param {string} network - GeckoTerminal network slug
   * @param {string} tokenAddress - Token contract address
   * @returns {Promise<NormalizedPool[]>}
   */
  async function fetchGeckoTerminalPools(network, tokenAddress) {
    if (!network) return [];
    const listUrl = `${Gecko_BASE}/networks/${network}/tokens/${tokenAddress}/pools`;
    var res;
    try {
      res = await fetch(listUrl, {
        headers: { Accept: 'application/json;version=20230203' },
      });
    } catch (e) {
      logError('GeckoTerminal', 'List fetch failed', e, listUrl);
      return [];
    }
    if (!res.ok) {
      logError('GeckoTerminal', 'List response not ok', null, listUrl, res.status);
      return [];
    }
    const json = await res.json();
    const data = json.data || [];
    const included = json.included || [];

    const tokenMap = new Map();
    included.forEach((inc) => {
      if (inc.type === 'token')
        tokenMap.set(inc.id, inc.attributes?.symbol || inc.attributes?.address || '—');
    });

    const listPools = data.slice(0, MAX_POOLS);
    const addresses = listPools.map((p) => (p.attributes || {}).address).filter(Boolean);
    const compositionByAddress = new Map();
    const headers = { Accept: 'application/json;version=20230203' };

    function setCompositionFromMultiData(multiData) {
      (multiData || []).forEach((pool) => {
        const att = pool.attributes || {};
        const addr = (att.address || '').toLowerCase();
        if (!addr) return;
        const baseBal = att.base_token_balance != null ? parseFloat(att.base_token_balance) : NaN;
        const quoteBal = att.quote_token_balance != null ? parseFloat(att.quote_token_balance) : NaN;
        compositionByAddress.set(addr, {
          baseAmount: Number.isNaN(baseBal) ? '—' : formatNumber(baseBal),
          quoteAmount: Number.isNaN(quoteBal) ? '—' : formatNumber(quoteBal),
        });
      });
    }

    if (addresses.length > 0) {
      try {
        var batchUrl = `${Gecko_BASE}/networks/${network}/pools/multi/${addresses.join(',')}?include_composition=true`;
        var batchRes = await fetch(batchUrl, { headers });
        if (batchRes.ok) {
          var batchJson = await batchRes.json();
          setCompositionFromMultiData(batchJson.data);
        } else {
          logError('GeckoTerminal', 'Batch multi failed, falling back to individual', null, batchUrl, batchRes.status);
        }
        var missing = addresses.filter(function (a) {
          return !compositionByAddress.has((a || '').toLowerCase());
        });
        for (var i = 0; i < missing.length; i++) {
          try {
            var oneUrl = `${Gecko_BASE}/networks/${network}/pools/multi/${encodeURIComponent(missing[i])}?include_composition=true`;
            var oneRes = await fetch(oneUrl, { headers });
            if (oneRes.ok) {
              var oneJson = await oneRes.json();
              setCompositionFromMultiData(oneJson.data);
            } else {
              logError('GeckoTerminal', 'Individual multi failed for pool ' + (i + 1), null, oneUrl, oneRes.status);
            }
          } catch (e) {
            logError('GeckoTerminal', 'Individual multi exception for pool ' + (i + 1), e, oneUrl);
          }
          if (i < missing.length - 1) await new Promise(function (r) { setTimeout(r, 100); });
        }
      } catch (e) {
        logError('GeckoTerminal', 'Batch multi exception', e, batchUrl);
      }
    }

    return listPools.map((p) => {
      const att = p.attributes || {};
      const name = att.name || '';
      const rel = p.relationships || {};
      const dexId = rel.dex?.data?.id;
      let pairStr = name.replace(/\s*\d+(?:\.\d+)?\s*%\s*$/, '').trim() || '—';
      if (pairStr === '—' && (rel.base_token?.data?.id || rel.quote_token?.data?.id)) {
        const baseSym = tokenMap.get(rel.base_token?.data?.id) || '—';
        const quoteSym = tokenMap.get(rel.quote_token?.data?.id) || '—';
        pairStr = `${baseSym} / ${quoteSym}`;
      }
      const parts = pairStr.split(/\s*\/\s*/);
      const baseSym = (parts[0] || '—').trim();
      const quoteSym = (parts[1] || '—').trim();
      const baseId = rel.base_token?.data?.id;
      const quoteId = rel.quote_token?.data?.id;
      const reserveUsd = parseFloat(att.reserve_in_usd) || 0;
      const addr = (att.address || '').toLowerCase();
      const composition = compositionByAddress.get(addr) || { baseAmount: '—', quoteAmount: '—' };
      return {
        pair: pairStr,
        liquidityUsd: reserveUsd,
        baseSymbol: baseSym,
        quoteSymbol: quoteSym,
        baseAddress: baseId ? normAddr(baseId) : '',
        quoteAddress: quoteId ? normAddr(quoteId) : '',
        baseAmount: composition.baseAmount,
        quoteAmount: composition.quoteAmount,
        dex: dexId || '—',
        url: `https://www.geckoterminal.com/${network}/pools/${att.address}`,
        geckoUrl: `https://www.geckoterminal.com/${network}/pools/${att.address}`,
        source: 'geckoterminal',
        sources: ['geckoterminal'],
      };
    });
  }

  /**
   * Fetch token pairs from Dexscreener.
   * @param {string} chainId - Dexscreener chain id
   * @param {string} tokenAddress - Token contract address
   * @returns {Promise<NormalizedPool[]>}
   */
  async function fetchDexscreenerPools(chainId, tokenAddress) {
    const url = `${DEXSCREENER_BASE}/token-pairs/v1/${chainId}/${tokenAddress}`;
    var res;
    try {
      res = await fetch(url);
    } catch (e) {
      logError('Dexscreener', 'Fetch failed', e, url);
      return [];
    }
    if (!res.ok) {
      logError('Dexscreener', 'Response not ok', null, url, res.status);
      return [];
    }
    const pairs = await res.json();
    if (!Array.isArray(pairs)) return [];

    return pairs
      .slice(0, MAX_POOLS * 2)
      .map((p) => {
        const base = p.baseToken?.symbol ?? '—';
        const quote = p.quoteToken?.symbol ?? '—';
        const baseAddr = (p.baseToken?.address || '').toLowerCase();
        const quoteAddr = (p.quoteToken?.address || '').toLowerCase();
        const liq = p.liquidity || {};
        const usd = typeof liq.usd === 'number' ? liq.usd : parseFloat(liq.usd) || 0;
        const baseAmount = liq.base != null ? formatNumber(liq.base) : '—';
        const quoteAmount = liq.quote != null ? formatNumber(liq.quote) : '—';
        return {
          pair: `${base} / ${quote}`,
          liquidityUsd: usd,
          baseSymbol: base,
          quoteSymbol: quote,
          baseAddress: baseAddr,
          quoteAddress: quoteAddr,
          baseAmount,
          quoteAmount,
          dex: p.dexId || '—',
          url: p.url || null,
          dexUrl: p.url || null,
          source: 'dexscreener',
          sources: ['dexscreener'],
        };
      })
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
      .slice(0, MAX_POOLS);
  }

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
      const res = await fetch(url, { method: 'HEAD', credentials: 'omit' });
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

  function renderSourceIcons(sources, geckoUrl, dexUrl, geckoInvalid) {
    if (!sources || !sources.length) return '—';
    const parts = [];
    const gtImg = `<img src="${escapeAttr(Gecko_FAVICON)}" alt="GT" class="dthelper-src-img" width="16" height="16">`;
    const dxImg = `<img src="${escapeAttr(DEXSCREENER_FAVICON)}" alt="DX" class="dthelper-src-img" width="16" height="16">`;
    if (sources.includes('geckoterminal')) {
      const gt = geckoUrl
        ? `<a class="dthelper-src dthelper-src-gt" href="${escapeAttr(geckoUrl)}" target="_blank" rel="noopener" title="GeckoTerminal">${gtImg}</a>`
        : `<span class="dthelper-src dthelper-src-gt" title="GeckoTerminal">${gtImg}</span>`;
      parts.push(gt);
      if (geckoInvalid) {
        parts.push('<span class="dthelper-src-invalid" title="Pool page not found on GeckoTerminal">❌</span>');
      }
    }
    if (sources.includes('dexscreener')) {
      const dx = dexUrl
        ? `<a class="dthelper-src dthelper-src-dx" href="${escapeAttr(dexUrl)}" target="_blank" rel="noopener" title="Dexscreener">${dxImg}</a>`
        : `<span class="dthelper-src dthelper-src-dx" title="Dexscreener">${dxImg}</span>`;
      parts.push(dx);
    }
    return parts.length ? '<span class="dthelper-src-wrap">' + parts.join('') + '</span>' : '—';
  }

  function formatUsd(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + Math.round(n);
  }

  function isViewedFirst(p, tokenAddress) {
    const addr = (tokenAddress || '').toLowerCase();
    if (!addr) return true;
    return p.baseAddress === addr;
  }

  function buildPairAndComposition(p, tokenAddress) {
    const viewedFirst = isViewedFirst(p, tokenAddress);
    const pair = viewedFirst
      ? `${p.baseSymbol} / ${p.quoteSymbol}`
      : `${p.quoteSymbol} / ${p.baseSymbol}`;
    const a1 = viewedFirst ? p.baseAmount : p.quoteAmount;
    const a2 = viewedFirst ? p.quoteAmount : p.baseAmount;
    const s1 = viewedFirst ? p.baseSymbol : p.quoteSymbol;
    const s2 = viewedFirst ? p.quoteSymbol : p.baseSymbol;
    const composition =
      a1 !== '—' && a2 !== '—' ? `${a1} ${s1} / ${a2} ${s2}` : (a1 !== '—' ? `${a1} ${s1}` : a2 !== '—' ? `${a2} ${s2}` : '—');
    const line1 = a1 !== '—' ? escapeHtml(a1 + ' ' + s1) : '—';
    const line2 = a2 !== '—' ? escapeHtml(a2 + ' ' + s2) : '—';
    const compositionHtml =
      `<span class="dthelper-pool-line">${line1}</span><br><span class="dthelper-pool-line">${line2}</span>`;
    return { pair, composition, compositionHtml };
  }

  function createPanelElement(pools, loading, error, tokenAddress, chainTheme, startCollapsed) {
    const root = document.createElement('div');
    root.id = POOL_ID;
    root.className = 'dthelper-panel';
    if (chainTheme) root.dataset.chain = chainTheme;

    const titleRow = document.createElement('div');
    titleRow.className = 'dthelper-title-row';
    const title = document.createElement('span');
    title.className = 'dthelper-title';
    title.textContent = 'Liquidity pools';
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'dthelper-collapse-btn';
    collapseBtn.setAttribute('aria-label', 'Collapse or expand');
    collapseBtn.textContent = startCollapsed ? '+' : '−';
    collapseBtn.dataset.expanded = startCollapsed ? '0' : '1';
    if (startCollapsed) root.classList.add('dthelper-collapsed');
    titleRow.appendChild(title);
    titleRow.appendChild(collapseBtn);

    const content = document.createElement('div');
    content.className = 'dthelper-content';

    if (error) {
      content.innerHTML = `<div class="dthelper-message dthelper-error">${escapeHtml(error)}</div>`;
    } else if (loading) {
      content.innerHTML = '<div class="dthelper-message dthelper-loading">Loading…</div>';
    } else if (!pools.length) {
      content.innerHTML = '<div class="dthelper-message">No pools found.</div>';
    } else {
      const table = document.createElement('table');
      table.className = 'dthelper-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Pair</th>
            <th>Liquidity</th>
            <th>Pool</th>
            <th>DEX</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');
      for (const p of pools) {
        const { pair, compositionHtml } = buildPairAndComposition(p, tokenAddress);
        const row = document.createElement('tr');
        if (p.url) {
          row.dataset.href = p.url;
          row.className = 'dthelper-row-link';
        }
        if (p.geckoUrl) row.dataset.geckoUrl = p.geckoUrl;
        const sourceIcons = renderSourceIcons(p.sources, p.geckoUrl, p.dexUrl, p.geckoInvalid);
        row.innerHTML = `
          <td class="dthelper-pair-cell">${escapeHtml(pair)}</td>
          <td class="dthelper-liquidity-cell">${formatUsd(p.liquidityUsd)}</td>
          <td class="dthelper-pool-cell">${compositionHtml}</td>
          <td class="dthelper-dex-cell">${escapeHtml(toHumanDex(p.dex))}</td>
          <td class="dthelper-src-cell">${sourceIcons}</td>
        `;
        tbody.appendChild(row);
      }
      tbody.addEventListener('click', function (e) {
        const row = e.target.closest('tr[data-href]');
        if (row && !e.target.closest('a')) {
          window.open(row.dataset.href, '_blank', 'noopener');
        }
      });
      content.appendChild(table);
    }

    collapseBtn.addEventListener('click', function () {
      const isCurrentlyCollapsed = root.classList.contains('dthelper-collapsed');
      if (!isCurrentlyCollapsed) {
        const rect = root.getBoundingClientRect();
        root.style.width = rect.width + 'px';
        root.classList.add('dthelper-collapsed');
        collapseBtn.dataset.expanded = '0';
        collapseBtn.textContent = '+';
      } else {
        root.classList.remove('dthelper-collapsed');
        collapseBtn.dataset.expanded = '1';
        collapseBtn.textContent = '−';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            const rect = root.getBoundingClientRect();
            root.style.width = rect.width + 'px';
          });
        });
      }
    });

    root.appendChild(titleRow);
    root.appendChild(content);
    return root;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const STORAGE_EXPANDED = 'dthelperExpanded';
  const STORAGE_SHOW_CARD = 'dthelperShowCard';

  function getSiteFamily() {
    const host = window.location.hostname.replace(/^www\./, '');
    if (host === 'solscan.io') return 'solscan';
    return 'etherscan';
  }

  function findInsertionPoint() {
    if (getSiteFamily() === 'solscan') {
      const el = document.querySelector(
        '#__next div[class*="mx-auto"][class*="max-w"] > div[class*="items-start"][class*="mb-"]'
      );
      if (el) return { refEl: el, position: 'afterend' };
    } else {
      const header = document.querySelector('main#content > section.container-xxl');
      if (header) return { refEl: header, position: 'afterend' };
    }
    return null;
  }

  function ensureInsertionPoint(callback, attempts) {
    if (!attempts) attempts = 0;
    if (findInsertionPoint() || attempts >= 20) { callback(); return; }
    setTimeout(function () { ensureInsertionPoint(callback, attempts + 1); }, 250);
  }

  const WRAPPER_ID = 'dthelper-wrapper';

  function applyEvmWrapperMargin(wrapper) {
    if (!wrapper || !wrapper.classList.contains('dthelper-wrapper-evm')) return;
    var ref = document.querySelector('main#content > section.container-xxl');
    var ml = ref ? window.getComputedStyle(ref).marginLeft : '';
    wrapper.style.marginLeft = ml;
  }

  var evmResizeListenerAdded = false;
  function ensureEvmResizeListener() {
    if (evmResizeListenerAdded) return;
    evmResizeListenerAdded = true;
    window.addEventListener('resize', function () {
      var w = document.getElementById(WRAPPER_ID);
      if (w) applyEvmWrapperMargin(w);
    });
  }

  function injectPanel(panelEl) {
    var existing = document.getElementById(POOL_ID);
    if (existing) existing.remove();

    var wrapper = document.getElementById(WRAPPER_ID);
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = WRAPPER_ID;
      wrapper.className = 'dthelper-wrapper' + (getSiteFamily() === 'etherscan' ? ' dthelper-wrapper-evm' : '');
      var point = findInsertionPoint();
      if (point) {
        point.refEl.insertAdjacentElement(point.position, wrapper);
      } else {
        var fallback = document.querySelector('main') || document.body;
        fallback.insertBefore(wrapper, fallback.firstChild);
      }
    }
    wrapper.innerHTML = '';
    wrapper.appendChild(panelEl);
    if (wrapper.classList.contains('dthelper-wrapper-evm')) {
      applyEvmWrapperMargin(wrapper);
      ensureEvmResizeListener();
    }
  }

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

  function run() {
    var txCtx = typeof getTxPageContext !== 'undefined' ? getTxPageContext() : null;
    if (txCtx) {
      runTxPage(txCtx);
      return;
    }
    getShowCardDefault(function (showCard) {
      if (!showCard) return;
      const ctx = getTokenPageContext();
      if (!ctx) return;
      ensureInsertionPoint(function () {
        loadAndShowPools(ctx);
      });
    });
  }

  /** Find the transaction hash row to insert "Search at" after. Returns { refEl, position } or null. */
  function findTxHashInsertionPoint() {
    if (getSiteFamily() === 'solscan') {
      var top = document.getElementById('top-tx-overview');
      if (!top) return null;
      var row = top.querySelector('div[class*="flex-row"][class*="flex-wrap"]');
      if (row) return { refEl: row, position: 'afterend' };
      return null;
    }
    var main = document.getElementById('ContentPlaceHolder1_maintable');
    if (!main) return null;
    var rows = main.querySelectorAll('.row.mb-4');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].textContent.indexOf('Transaction Hash') !== -1) {
        return { refEl: rows[i], position: 'afterend' };
      }
    }
    return null;
  }

  function createSearchAtSection(txHash) {
    if (!txHash || typeof BRIDGE_SCANNERS === 'undefined') return null;
    var wrap = document.createElement('div');
    wrap.className = 'dthelper-search-at' + (window.location.hostname === 'solscan.io' ? ' dthelper-search-at--solscan' : '');
    var label = document.createElement('span');
    label.className = 'dthelper-search-at-label';
    label.textContent = 'Search at';
    var btnRow = document.createElement('div');
    btnRow.className = 'dthelper-search-at-buttons';
    BRIDGE_SCANNERS.forEach(function (b) {
      var href = typeof b.url === 'function' ? b.url(txHash) : (b.url || '#');
      var a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'dthelper-bridge-btn';
      a.title = b.name;
      var img = document.createElement('img');
      img.src = (b.logo && b.logo.startsWith('http') ? b.logo : (b.logo ? chrome.runtime.getURL(b.logo) : ''));
      img.alt = b.name;
      img.className = 'dthelper-bridge-btn-img';
      img.onerror = function () {
        var fallback = document.createElement('span');
        fallback.className = 'dthelper-bridge-btn-fallback';
        fallback.textContent = (b.name || '?').charAt(0);
        a.replaceChild(fallback, img);
      };
      a.appendChild(img);
      btnRow.appendChild(a);
    });
    wrap.appendChild(label);
    wrap.appendChild(btnRow);
    return wrap;
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
  }
})();
