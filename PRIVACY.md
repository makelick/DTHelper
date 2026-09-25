# DT Helper - Privacy Policy

_Last updated: 2026-09-25_

DT Helper is a browser extension that shows liquidity pool data and token tax information on block explorer token pages.

## What the extension does with data

- It reads the **URL of the explorer page you are on** to detect token and transaction pages. Nothing else on the page is read or modified beyond inserting its own panel.
- To show pool data, it sends the **token contract address from that URL** to public third-party APIs: GeckoTerminal (`api.geckoterminal.com`, `www.geckoterminal.com`), Dexscreener (`api.dexscreener.com`), honeypot.is (`api.honeypot.is`) and GoPlus (`api.gopluslabs.io`). These requests are made without cookies or credentials. Token contract addresses are public on-chain identifiers, not personal data.
- Your settings (show card, expanded by default, debug logging) are stored locally in your browser using `chrome.storage.local`. They never leave your device.

## What the extension does not do

- It does not collect, store or transmit any personal information, browsing history, wallet addresses or credentials.
- It does not use analytics, tracking or advertising.
- It does not sell or share data with anyone.

## Third-party services

Requests to the APIs above are subject to those services' own privacy policies. The extension only sends the token address and chain identifier needed to answer each request.

## Contact

Open an issue at https://github.com/makelick/DTHelper/issues.
