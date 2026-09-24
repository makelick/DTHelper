'use strict';

const Gecko_BASE = 'https://api.geckoterminal.com/api/v2';
const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const Gecko_FAVICON = 'https://www.geckoterminal.com/favicon.ico';
const DEXSCREENER_FAVICON = 'https://dexscreener.com/favicon.ico';
const MAX_POOLS = 5;
const POOL_ID = 'dthelper-liquidity-panel';
const STORAGE_DEBUG = 'dthelperDebug';
const STORAGE_EXPANDED = 'dthelperExpanded';
const STORAGE_SHOW_CARD = 'dthelperShowCard';
const WRAPPER_ID = 'dthelper-wrapper';

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
