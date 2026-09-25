# Chrome Web Store listing

## Name
DT Helper

## Summary (max 132 chars)
Liquidity pools, 24h volume/trades and token taxes (honeypot.is, GoPlus) on Etherscan-style explorers and Solscan token pages.

## Category
Developer Tools (alternative: Productivity)

## Language
English

## Description

DT Helper adds the on-chain context you usually open three other tabs for, right on the block explorer token page.

LIQUIDITY POOLS
On every token page it shows the largest pools for that token, merged from GeckoTerminal and Dexscreener by pool address:
- Pair and DEX
- Total liquidity in USD and the amount of each token in the pool
- 24h volume and 24h trades (buys / sells), so you can see at a glance whether a pool is actually active. Dead pools are dimmed.
- Direct links to the pool on GeckoTerminal and Dexscreener

TOKEN TAXES
Under the token contract address it adds a compact row with buy / sell / transfer tax and a HONEYPOT warning:
- Ethereum, BSC, Base: honeypot.is simulation (retries on other pools if the default one fails)
- Arbitrum, Polygon, Optimism, Avalanche, Gnosis, Unichain, Sonic, Berachain, Robinhood Chain, Arc: GoPlus token security data

BRIDGE LOOKUP
On transaction pages it adds "Search at" buttons that open the same hash on LayerZero Scan, Wormholescan, Axelarscan, deBridge and Hyperlane explorer.

SUPPORTED EXPLORERS
Etherscan, BscScan, PolygonScan, BaseScan, Arbiscan, SnowScan, Optimistic Etherscan, Uniscan, Berascan, GnosisScan, SonicScan, HyperEVM Scan, RobinScan (robin.etherscan.io), Arc (arc.etherscan.io) and Solscan.

PRIVACY
No accounts, no tracking. The extension only sends the token address from the page URL to public APIs (GeckoTerminal, Dexscreener, honeypot.is, GoPlus) and keeps its three settings in local browser storage. Source code: https://github.com/makelick/DTHelper

## Single purpose (Privacy practices tab)
Show liquidity pool, trading activity and token tax data for the token displayed on a block explorer token page.

## Permission justifications (Privacy practices tab)

storage
Stores three user preferences locally (show the pools card, expand it by default, enable debug logging).

Host permissions - explorer sites (etherscan.io, bscscan.com, polygonscan.com, basescan.org, arbiscan.io, snowscan.xyz, optimistic.etherscan.io, uniscan.xyz, berascan.com, gnosisscan.io, sonicscan.org, hyperevmscan.io, robin.etherscan.io, arc.etherscan.io, solscan.io)
Needed to run the content script that reads the token address from the page URL and inserts the pools card and tax row into token pages, and the bridge search buttons into transaction pages.

Host permissions - api.geckoterminal.com, www.geckoterminal.com, api.dexscreener.com, api.honeypot.is, api.gopluslabs.io
Needed to fetch pool liquidity/volume/trade data and token tax data for the token address shown on the page. Requests are sent from the extension's service worker without cookies.

Remote code
No. All code is packaged in the extension. Only JSON data and image files are fetched from remote hosts.

## Data usage certification
Does not collect or use user data. (Token contract addresses sent to APIs are public blockchain identifiers taken from the page URL, not personal or user-generated data.)

## Privacy policy URL
https://github.com/makelick/DTHelper/blob/main/PRIVACY.md

## Assets
- Icon 128x128 PNG: icons/icon128.png
- Screenshots 1280x800 PNG: store/screenshot-*.png
- Small promo tile 440x280 (optional): store/promo-440x280.png
