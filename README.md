# DT Helper — On-chain analysis browser extension

A browser extension that adds **liquidity pool data** from [GeckoTerminal](https://www.geckoterminal.com/) and [Dexscreener](https://dexscreener.com/) on token pages of supported block explorers.

## Supported sites

The extension only runs on these domains:

- https://solscan.io/
- https://etherscan.io/
- https://bscscan.com/
- https://polygonscan.com/
- https://basescan.org/
- https://arbiscan.io/
- https://snowscan.xyz/
- https://optimistic.etherscan.io/
- https://uniscan.xyz/
- https://berascan.com/
- https://gnosisscan.io/
- https://sonicscan.org/
- https://hyperevmscan.io/
- https://robin.etherscan.io/ (Robinhood Chain)
- https://arc.etherscan.io/ (Arc)

## What it does

On **token pages** (e.g. `etherscan.io/token/0x...` or `solscan.io/token/<address>`), it injects a panel that shows:

- **Token pair** (e.g. WETH / USDC)
- **Total liquidity** (USD)
- **Base / quote amounts** in the pool (when available from Dexscreener)
- **DEX** name
- **Pool fee** (when available from GeckoTerminal pool name, e.g. 0.05%)
- **Link** to the pool on GeckoTerminal or Dexscreener

Data is loaded automatically when you open a token page. Up to 10 of the largest pools are shown, merged from both APIs.

## Install (Chrome / Edge)

1. Clone or download this folder.
2. Open `chrome://extensions/` (or `edge://extensions/`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `DTHelper` folder (the one containing `manifest.json`).

## Install (Firefox)

1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**.
2. Select the `manifest.json` file inside the `DTHelper` folder.

## Permissions

- **Host permissions** only for the block explorer domains listed above and for `api.geckoterminal.com` and `api.dexscreener.com` (to fetch pool data). No other permissions are requested.