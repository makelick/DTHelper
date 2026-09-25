'use strict';

function extensionFetch(url, options) {
  return new Promise(function (resolve, reject) {
    chrome.runtime.sendMessage(
      { type: 'fetch', url: url, options: { method: options.method || 'GET', headers: options.headers || {} } },
      function (response) {
        if (chrome.runtime.lastError) {
          reject(new TypeError('Failed to fetch'));
          return;
        }
        if (response && response.error) {
          reject(new TypeError('Failed to fetch'));
          return;
        }
        resolve({ ok: response.ok, status: response.status, body: response.body });
      }
    );
  });
}

async function fetchGeckoTerminalPools(network, tokenAddress) {
  if (!network) return [];
  const listUrl = `${Gecko_BASE}/networks/${network}/tokens/${tokenAddress}/pools`;
  var res;
  try {
    res = await extensionFetch(listUrl, {
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
  const json = JSON.parse(res.body);
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
      var batchRes = await extensionFetch(batchUrl, { headers });
      if (batchRes.ok) {
        var batchJson = JSON.parse(batchRes.body);
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
          var oneRes = await extensionFetch(oneUrl, { headers });
          if (oneRes.ok) {
            var oneJson = JSON.parse(oneRes.body);
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
    const vol = att.volume_usd || {};
    const tx24 = (att.transactions || {}).h24 || {};
    return {
      volume24h: parseFloat(vol.h24) || 0,
      buys24h: Number(tx24.buys) || 0,
      sells24h: Number(tx24.sells) || 0,
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

async function fetchDexscreenerPools(chainId, tokenAddress) {
  const url = `${DEXSCREENER_BASE}/token-pairs/v1/${chainId}/${tokenAddress}`;
  var res;
  try {
    res = await extensionFetch(url, {});
  } catch (e) {
    logError('Dexscreener', 'Fetch failed', e, url);
    return [];
  }
  if (!res.ok) {
    logError('Dexscreener', 'Response not ok', null, url, res.status);
    return [];
  }
  const pairs = JSON.parse(res.body);
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
      const vol = p.volume || {};
      const tx24 = (p.txns || {}).h24 || {};
      return {
        volume24h: typeof vol.h24 === 'number' ? vol.h24 : parseFloat(vol.h24) || 0,
        buys24h: Number(tx24.buys) || 0,
        sells24h: Number(tx24.sells) || 0,
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

function parseHoneypotResponse(json) {
  const sim = json.simulationResult || {};
  const summary = json.summary || {};
  return {
    isHoneypot: !!(json.honeypotResult && json.honeypotResult.isHoneypot),
    honeypotReason: json.honeypotResult && json.honeypotResult.honeypotReason ? String(json.honeypotResult.honeypotReason) : '',
    simulationSuccess: json.simulationSuccess !== false,
    simulationError: json.simulationError ? String(json.simulationError) : '',
    buyTax: sim.buyTax != null ? Number(sim.buyTax) : null,
    sellTax: sim.sellTax != null ? Number(sim.sellTax) : null,
    transferTax: sim.transferTax != null ? Number(sim.transferTax) : null,
    flags: Array.isArray(summary.flags) ? summary.flags.map(function (f) { return typeof f === 'string' ? f : (f && (f.description || f.flag || f.name)) || ''; }).filter(Boolean) : [],
    openSource: json.contractCode ? json.contractCode.openSource !== false : null,
    pairName: json.pair && json.pair.pair && json.pair.pair.name ? String(json.pair.pair.name) : '',
    pairAddress: json.pairAddress ? String(json.pairAddress).toLowerCase() : '',
    tokenSymbol: json.token && json.token.symbol ? String(json.token.symbol) : '',
  };
}

async function honeypotRequest(chainId, tokenAddress, pairAddress) {
  var url = `${HONEYPOT_BASE}/v2/IsHoneypot?address=${encodeURIComponent(tokenAddress)}&chainID=${encodeURIComponent(chainId)}`;
  if (pairAddress) url += '&pair=' + encodeURIComponent(pairAddress);
  var res;
  try {
    res = await extensionFetch(url, { headers: { Accept: 'application/json' } });
  } catch (e) {
    logError('Honeypot', 'Fetch failed', e, url);
    throw e;
  }
  var json = null;
  try { json = JSON.parse(res.body); } catch (_) { json = null; }
  if (!res.ok) {
    logError('Honeypot', 'Response not ok', null, url, res.status);
    var msg = json && (json.message || json.error) ? String(json.message || json.error) : 'HTTP ' + res.status;
    throw new Error(msg);
  }
  if (!json || typeof json !== 'object') throw new Error('Invalid response');
  return parseHoneypotResponse(json);
}

async function fetchHoneypotPairs(chainId, tokenAddress) {
  const url = `${HONEYPOT_BASE}/v1/GetPairs?address=${encodeURIComponent(tokenAddress)}&chainID=${encodeURIComponent(chainId)}`;
  try {
    const res = await extensionFetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      logError('Honeypot', 'GetPairs not ok', null, url, res.status);
      return [];
    }
    const list = JSON.parse(res.body);
    if (!Array.isArray(list)) return [];
    return list
      .map(function (p) {
        const pair = p && p.Pair ? p.Pair : {};
        return { address: pair.Address ? String(pair.Address).toLowerCase() : '', name: pair.Name || '', liquidity: Number(p.Liquidity) || 0 };
      })
      .filter(function (p) { return p.address; })
      .sort(function (a, b) { return b.liquidity - a.liquidity; });
  } catch (e) {
    logError('Honeypot', 'GetPairs failed', e, url);
    return [];
  }
}

async function fetchHoneypot(chainId, tokenAddress) {
  const first = await honeypotRequest(chainId, tokenAddress, null);
  if (first.simulationSuccess) return first;

  // Default pair failed to simulate: retry on the next most liquid pools.
  const pairs = await fetchHoneypotPairs(chainId, tokenAddress);
  const candidates = pairs.filter(function (p) { return p.address !== first.pairAddress; }).slice(0, HONEYPOT_FALLBACK_PAIRS);
  var last = first;
  for (var i = 0; i < candidates.length; i++) {
    try {
      const r = await honeypotRequest(chainId, tokenAddress, candidates[i].address);
      if (r.simulationSuccess) {
        r.fallbackPair = true;
        r.failedPairName = first.pairName;
        return r;
      }
      last = r;
    } catch (e) {
      logError('Honeypot', 'Fallback pair ' + (i + 1) + ' failed', e, candidates[i].address);
    }
  }
  last.triedPairs = 1 + candidates.length;
  return last;
}

function goplusPct(v) {
  if (v === '' || v == null) return null;
  const x = parseFloat(v);
  return Number.isNaN(x) ? null : x * 100;
}

async function fetchGoPlus(chainId, tokenAddress) {
  const url = `${GOPLUS_BASE}/token_security/${encodeURIComponent(chainId)}?contract_addresses=${encodeURIComponent(tokenAddress)}`;
  var res;
  try {
    res = await extensionFetch(url, { headers: { Accept: 'application/json' } });
  } catch (e) {
    logError('GoPlus', 'Fetch failed', e, url);
    throw e;
  }
  var json = null;
  try { json = JSON.parse(res.body); } catch (_) { json = null; }
  if (!res.ok) {
    logError('GoPlus', 'Response not ok', null, url, res.status);
    throw new Error(json && json.message ? String(json.message) : 'HTTP ' + res.status);
  }
  if (!json || typeof json !== 'object') throw new Error('Invalid response');
  if (json.code !== 1 && json.code !== '1') throw new Error(json.message ? String(json.message) : 'GoPlus error');
  const result = json.result || {};
  const key = Object.keys(result).find(function (k) { return k.toLowerCase() === tokenAddress.toLowerCase(); }) || Object.keys(result)[0];
  const t = key ? result[key] : null;
  if (!t) return { simulationSuccess: false, simulationError: 'Token not found on GoPlus', buyTax: null, sellTax: null, transferTax: null, flags: [], openSource: null, pairName: '', isHoneypot: false, honeypotReason: '' };

  const buyTax = goplusPct(t.buy_tax);
  const sellTax = goplusPct(t.sell_tax);
  const transferTax = goplusPct(t.transfer_tax);
  const flags = [];
  if (t.cannot_sell_all === '1') flags.push('Cannot sell all tokens at once');
  if (t.honeypot_with_same_creator === '1') flags.push('Creator has deployed honeypots before');
  if (t.is_mintable === '1') flags.push('Mintable');
  if (t.can_take_back_ownership === '1') flags.push('Ownership can be taken back');
  if (t.is_blacklisted === '1') flags.push('Has blacklist');
  if (t.transfer_pausable === '1') flags.push('Transfers can be paused');
  if (t.slippage_modifiable === '1') flags.push('Tax can be modified');
  if (t.is_proxy === '1') flags.push('Proxy contract');
  const hasTax = buyTax != null || sellTax != null;
  return {
    isHoneypot: t.is_honeypot === '1',
    honeypotReason: t.is_honeypot === '1' ? 'GoPlus flagged this token as a honeypot' : '',
    simulationSuccess: hasTax,
    simulationError: hasTax ? '' : (t.is_open_source === '0' ? 'Closed-source contract, tax unknown' : 'Tax unknown'),
    buyTax: buyTax,
    sellTax: sellTax,
    transferTax: transferTax,
    flags: flags,
    openSource: t.is_open_source == null || t.is_open_source === '' ? null : t.is_open_source === '1',
    pairName: '',
    tokenSymbol: t.token_symbol ? String(t.token_symbol) : '',
  };
}
