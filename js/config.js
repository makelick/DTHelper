'use strict';

const SCANNER_CONFIG = {
  'solscan.io': {
    geckoNetwork: 'solana',
    dexscreenerChainId: 'solana',
    tokenPathPattern: /^\/token\/([A-HJ-NP-Za-km-z1-9]{32,44})/,
    theme: 'solana',
  },
  'etherscan.io': {
    taxProvider: 'honeypot',
    honeypotChainId: '1',
    honeypotPath: 'ethereum',
    geckoNetwork: 'eth',
    dexscreenerChainId: 'ethereum',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'ethereum',
  },
  'bscscan.com': {
    taxProvider: 'honeypot',
    honeypotChainId: '56',
    honeypotPath: '',
    geckoNetwork: 'bsc',
    dexscreenerChainId: 'bsc',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'bsc',
  },
  'polygonscan.com': {
    taxProvider: 'goplus',
    goplusChainId: '137',
    geckoNetwork: 'polygon_pos',
    dexscreenerChainId: 'polygon',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'polygon',
  },
  'basescan.org': {
    taxProvider: 'honeypot',
    honeypotChainId: '8453',
    honeypotPath: 'base',
    geckoNetwork: 'base',
    dexscreenerChainId: 'base',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'base',
  },
  'arbiscan.io': {
    taxProvider: 'goplus',
    goplusChainId: '42161',
    geckoNetwork: 'arbitrum',
    dexscreenerChainId: 'arbitrum',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'arbitrum',
  },
  'snowscan.xyz': {
    taxProvider: 'goplus',
    goplusChainId: '43114',
    geckoNetwork: 'avax',
    dexscreenerChainId: 'avalanche',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'avalanche',
  },
  'optimistic.etherscan.io': {
    taxProvider: 'goplus',
    goplusChainId: '10',
    geckoNetwork: 'optimism',
    dexscreenerChainId: 'optimism',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'optimism',
  },
  'uniscan.xyz': {
    taxProvider: 'goplus',
    goplusChainId: '130',
    geckoNetwork: 'unichain',
    dexscreenerChainId: 'unichain',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'unichain',
  },
  'berascan.com': {
    taxProvider: 'goplus',
    goplusChainId: '80094',
    geckoNetwork: 'berachain',
    dexscreenerChainId: 'berachain',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'berachain',
  },
  'gnosisscan.io': {
    taxProvider: 'goplus',
    goplusChainId: '100',
    geckoNetwork: 'xdai',
    dexscreenerChainId: 'xdai',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'gnosis',
  },
  'sonicscan.org': {
    taxProvider: 'goplus',
    goplusChainId: '146',
    geckoNetwork: 'sonic',
    dexscreenerChainId: 'sonic',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'sonic',
  },
  'hyperevmscan.io': {
    geckoNetwork: 'hyperevm',
    dexscreenerChainId: 'hyperevm',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'hyperevm',
  },
  'robin.etherscan.io': {
    taxProvider: 'goplus',
    goplusChainId: '4663',
    geckoNetwork: 'robinhood',
    dexscreenerChainId: 'robinhood',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'robinhood',
  },
  'arc.etherscan.io': {
    taxProvider: 'goplus',
    goplusChainId: '5042',
    geckoNetwork: 'arc',
    dexscreenerChainId: 'arc',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'arc',
  },
};

function getScannerConfig() {
  const host = window.location.hostname.replace(/^www\./, '');
  return SCANNER_CONFIG[host] || null;
}

function getNormalizedPathname() {
  return window.location.pathname.replace(/\/+/g, '/');
}

function getTokenPageContext() {
  const config = getScannerConfig();
  if (!config) return null;
  const match = getNormalizedPathname().match(config.tokenPathPattern);
  if (!match) return null;
  const address = match[1];
  if (!address) return null;
  return { address, config };
}

function getTxPageContext() {
  const config = getScannerConfig();
  if (!config) return null;
  const path = getNormalizedPathname();
  const evmMatch = path.match(/^\/tx\/(0x[a-fA-F0-9]{64})$/);
  if (evmMatch) return { txHash: evmMatch[1], config };
  const solMatch = path.match(/^\/tx\/([A-HJ-NP-Za-km-z1-9]{32,88})$/);
  if (solMatch) return { txHash: solMatch[1], config };
  return null;
}

const BRIDGE_SCANNERS = [
  { id: 'layerzero', name: 'LayerZero', url: function (h) { return 'https://layerzeroscan.com/tx/' + encodeURIComponent(h); }, logo: 'icons/layerzero.ico' },
  { id: 'wormhole', name: 'Wormhole', url: function (h) { return 'https://wormholescan.io/#/tx/' + encodeURIComponent(h); }, logo: 'icons/wormhole.svg' },
  { id: 'axelar', name: 'Axelar', url: function (h) { return 'https://axelarscan.io/gmp/' + encodeURIComponent(h.replace(/^0x/, '').toUpperCase()); }, logo: 'icons/axelar.ico' },
  { id: 'debridge', name: 'deBridge', url: function (h) { return 'https://app.debridge.com/messages?s=' + encodeURIComponent(h); }, logo: 'icons/debridge.ico' },
  { id: 'hyperlane', name: 'Hyperlane', url: function (h) { return 'https://explorer.hyperlane.xyz/?search=' + encodeURIComponent(h); }, logo: 'icons/hyperlane.png' },
];
