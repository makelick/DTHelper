/**
 * Scanner host -> chain configuration for GeckoTerminal and Dexscreener APIs.
 * GeckoTerminal: network slug. Dexscreener: chainId for token-pairs endpoint.
 */
const SCANNER_CONFIG = {
  'solscan.io': {
    geckoNetwork: 'solana',
    dexscreenerChainId: 'solana',
    tokenPathPattern: /^\/token\/([A-HJ-NP-Za-km-z1-9]{32,44})/,
    theme: 'solana',
  },
  'etherscan.io': {
    geckoNetwork: 'eth',
    dexscreenerChainId: 'ethereum',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'ethereum',
  },
  'bscscan.com': {
    geckoNetwork: 'bsc',
    dexscreenerChainId: 'bsc',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'bsc',
  },
  'polygonscan.com': {
    geckoNetwork: 'polygon_pos',
    dexscreenerChainId: 'polygon',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'polygon',
  },
  'basescan.org': {
    geckoNetwork: 'base',
    dexscreenerChainId: 'base',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'base',
  },
  'arbiscan.io': {
    geckoNetwork: 'arbitrum',
    dexscreenerChainId: 'arbitrum',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'arbitrum',
  },
  'snowscan.xyz': {
    geckoNetwork: 'avax',
    dexscreenerChainId: 'avalanche',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'avalanche',
  },
  'optimistic.etherscan.io': {
    geckoNetwork: 'optimism',
    dexscreenerChainId: 'optimism',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'optimism',
  },
  'uniscan.xyz': {
    geckoNetwork: null,
    dexscreenerChainId: 'unichain',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'unichain',
  },
  'berascan.com': {
    geckoNetwork: null,
    dexscreenerChainId: 'berachain',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'berachain',
  },
  'gnosisscan.io': {
    geckoNetwork: 'xdai',
    dexscreenerChainId: 'gnosis',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'gnosis',
  },
  'sonicscan.org': {
    geckoNetwork: null,
    dexscreenerChainId: 'sonic',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'sonic',
  },
  'hyperevmscan.io': {
    geckoNetwork: null,
    dexscreenerChainId: 'hyperevm',
    tokenPathPattern: /^\/token\/(0x[a-fA-F0-9]{40})/,
    theme: 'hyperevm',
  },
};

/**
 * Get config for current origin. Uses hostname (no port).
 */
function getScannerConfig() {
  const host = window.location.hostname.replace(/^www\./, '');
  return SCANNER_CONFIG[host] || null;
}

/**
 * Extract token address from current URL pathname.
 * Returns { address, config } or null if not a token page.
 */
function getTokenPageContext() {
  const config = getScannerConfig();
  if (!config) return null;
  const match = window.location.pathname.match(config.tokenPathPattern);
  if (!match) return null;
  const address = match[1];
  if (!address) return null;
  return { address, config };
}
