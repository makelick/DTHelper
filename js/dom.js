'use strict';

function getSiteFamily() {
  const host = window.location.hostname.replace(/^www\./, '');
  if (host === 'solscan.io') return 'solscan';
  return 'etherscan';
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

var evmResizeListenerAdded = false;
function ensureEvmResizeListener() {
  if (evmResizeListenerAdded) return;
  evmResizeListenerAdded = true;
  window.addEventListener('resize', function () {
    var w = document.getElementById(WRAPPER_ID);
    if (w) applyEvmWrapperMargin(w);
  });
}

function applyEvmWrapperMargin(wrapper) {
  if (!wrapper || !wrapper.classList.contains('dthelper-wrapper-evm')) return;
  var ref = document.querySelector('main#content > section.container-xxl');
  var ml = ref ? window.getComputedStyle(ref).marginLeft : '';
  wrapper.style.marginLeft = ml;
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
