(function () {
  'use strict';

  const GEcko_BASE = 'https://api.geckoterminal.com/api/v2';
  const DEXSCREENER_BASE = 'https://api.dexscreener.com';
  const MAX_POOLS = 5;
  const POOL_ID = 'dthelper-liquidity-panel';

  /** Human-readable DEX names (dexId -> display). */
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

  /** Normalized pool: pair order and composition are built at render using tokenAddress. */
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
    return x.toFixed(4);
  }

  /**
   * Fetch top pools for a token from GeckoTerminal.
   * @param {string} network - GeckoTerminal network slug
   * @param {string} tokenAddress - Token contract address
   * @returns {Promise<NormalizedPool[]>}
   */
  async function fetchGeckoTerminalPools(network, tokenAddress) {
    if (!network) return [];
    const url = `${GEcko_BASE}/networks/${network}/tokens/${tokenAddress}/pools`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json;version=20230203' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data || [];
    const included = json.included || [];

    const dexMap = new Map();
    const tokenMap = new Map();
    included.forEach((inc) => {
      if (inc.type === 'dex') dexMap.set(inc.id, inc.attributes?.name || inc.id);
      if (inc.type === 'token')
        tokenMap.set(inc.id, inc.attributes?.symbol || inc.attributes?.address || '—');
    });

    return data.slice(0, MAX_POOLS).map((p) => {
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
      const basePrice = parseFloat(att.base_token_price_usd) || 0;
      const quotePrice = parseFloat(att.quote_token_price_usd) || 0;
      let baseAmount = '—';
      let quoteAmount = '—';
      if (reserveUsd > 0 && basePrice > 0 && quotePrice > 0) {
        const halfUsd = reserveUsd / 2;
        baseAmount = formatNumber(halfUsd / basePrice);
        quoteAmount = formatNumber(halfUsd / quotePrice);
      }
      return {
        pair: pairStr,
        liquidityUsd: reserveUsd,
        baseSymbol: baseSym,
        quoteSymbol: quoteSym,
        baseAddress: baseId ? normAddr(baseId) : '',
        quoteAddress: quoteId ? normAddr(quoteId) : '',
        baseAmount,
        quoteAmount,
        dex: dexId || '—',
        url: `https://www.geckoterminal.com/${network}/pools/${att.address}`,
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
    const res = await fetch(url);
    if (!res.ok) return [];
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
          source: 'dexscreener',
          sources: ['dexscreener'],
        };
      })
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
      .slice(0, MAX_POOLS);
  }

  /**
   * Merge and dedupe by pair+dex, keep top by liquidity; prefer Dexscreener amounts when present.
   */
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

  function renderSourceIcons(sources) {
    if (!sources || !sources.length) return '—';
    const parts = [];
    if (sources.includes('geckoterminal')) {
      parts.push('<span class="dthelper-src dthelper-src-gt" title="GeckoTerminal">GT</span>');
    }
    if (sources.includes('dexscreener')) {
      parts.push('<span class="dthelper-src dthelper-src-dx" title="Dexscreener">DX</span>');
    }
    return parts.length ? parts.join('') : '—';
  }

  function formatUsd(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + n.toFixed(2);
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
    const compositionHtml =
      a1 !== '—' && a2 !== '—'
        ? `<span class="dthelper-pool-line">${escapeHtml(a1 + ' ' + s1)}</span><br><span class="dthelper-pool-line">${escapeHtml(a2 + ' ' + s2)}</span>`
        : a1 !== '—'
          ? `<span class="dthelper-pool-line">${escapeHtml(a1 + ' ' + s1)}</span>`
          : a2 !== '—'
            ? `<span class="dthelper-pool-line">${escapeHtml(a2 + ' ' + s2)}</span>`
            : '—';
    return { pair, composition, compositionHtml };
  }

  function createPanelElement(pools, loading, error, tokenAddress, chainTheme, startCollapsed) {
    const root = document.createElement('div');
    root.id = POOL_ID;
    root.className = 'dthelper-panel';
    if (chainTheme) root.dataset.chain = chainTheme;

    const titleRow = document.createElement('div');
    titleRow.className = 'dthelper-title-row dthelper-drag-handle';
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
        const sourceIcons = renderSourceIcons(p.sources);
        row.innerHTML = `
          <td class="dthelper-pair-cell">${escapeHtml(pair)}</td>
          <td>${formatUsd(p.liquidityUsd)}</td>
          <td class="dthelper-pool-cell">${compositionHtml}</td>
          <td>${escapeHtml(toHumanDex(p.dex))}</td>
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
      const expanded = root.classList.toggle('dthelper-collapsed');
      collapseBtn.dataset.expanded = expanded ? '0' : '1';
      collapseBtn.textContent = expanded ? '+' : '−';
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

  const WRAPPER_ID = 'dthelper-wrapper';
  const STORAGE_POSITION = 'dthelperPosition';
  const STORAGE_EXPANDED = 'dthelperExpanded';

  function setupWrapperDrag(wrapper) {
    if (wrapper.dataset.dragSetup === '1') return;
    wrapper.dataset.dragSetup = '1';
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    wrapper.addEventListener('mousedown', function (e) {
      if (!e.target.closest('.dthelper-drag-handle') || e.target.closest('.dthelper-collapse-btn')) return;
      e.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      const style = wrapper.style;
      /* Switch from right-based to left-based positioning so drag moves the whole card */
      style.left = rect.left + 'px';
      style.top = rect.top + 'px';
      style.right = 'auto';
      startLeft = rect.left;
      startTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;

      function onMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        wrapper.style.left = (startLeft + dx) + 'px';
        wrapper.style.top = (startTop + dy) + 'px';
        startLeft += dx;
        startTop += dy;
        startX = e.clientX;
        startY = e.clientY;
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const rect = wrapper.getBoundingClientRect();
        try {
          chrome.storage.local.set({ [STORAGE_POSITION]: { left: rect.left, top: rect.top } });
        } catch (err) {}
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function applyStoredPosition(wrapper) {
    try {
      chrome.storage.local.get([STORAGE_POSITION], function (r) {
        const pos = r[STORAGE_POSITION];
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
          wrapper.style.left = pos.left + 'px';
          wrapper.style.top = pos.top + 'px';
          wrapper.style.right = 'auto';
        }
      });
    } catch (err) {}
  }

  function injectPanel(panelEl) {
    let wrapper = document.getElementById(WRAPPER_ID);
    const existing = document.getElementById(POOL_ID);
    if (existing) existing.remove();
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = WRAPPER_ID;
      wrapper.className = 'dthelper-wrapper';
      document.body.appendChild(wrapper);
      applyStoredPosition(wrapper);
      setupWrapperDrag(wrapper);
    }
    wrapper.appendChild(panelEl);
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

    getExpandedDefault(function (expanded) {
      const startCollapsed = !expanded;
      const container = createPanelElement([], true, null, address, chainTheme, startCollapsed);
      injectPanel(container);
    });

    let geckoPools = [];
    let dexscreenerPools = [];
    let error = null;

    try {
      const [gk, dx] = await Promise.all([
        config.geckoNetwork ? fetchGeckoTerminalPools(config.geckoNetwork, address) : [],
        fetchDexscreenerPools(config.dexscreenerChainId, address),
      ]);
      geckoPools = Array.isArray(gk) ? gk : [];
      dexscreenerPools = Array.isArray(dx) ? dx : [];
    } catch (e) {
      error = e && e.message ? e.message : 'Failed to load pool data';
    }

    const merged = mergePools(geckoPools, dexscreenerPools);
    getExpandedDefault(function (expanded) {
      const startCollapsed = !expanded;
      const newPanel = createPanelElement(merged, false, error, address, chainTheme, startCollapsed);
      injectPanel(newPanel);
    });
  }

  function run() {
    const ctx = getTokenPageContext();
    if (!ctx) return;
    loadAndShowPools(ctx);
  }

  if (typeof getTokenPageContext !== 'undefined') {
    run();
  }
})();
