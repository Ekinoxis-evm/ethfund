---
name: blockscout
description: Read onchain data (transactions, addresses, contracts, tokens, balances) via the Blockscout MCP, multichain. Use when verifying token/contract state, debugging market resolution, or inspecting USDC/CTF transfers.
---

# Blockscout (onchain reads via MCP)

Configured in `.mcp.json` as the `blockscout` HTTP MCP (`https://mcp.blockscout.com/mcp`). An optional
`BLOCKSCOUT_PRO_API_KEY` (`proapi_...`, from https://dev.blockscout.com) raises rate limits — set it
in the root `.env`; reads work without it.

## When to use in ethfund

- Verify a Polymarket market's onchain state: the CTF condition/token, USDC (6 decimals) movements,
  and resolution transactions — useful when an opportunity's outcome needs confirming for backtesting.
- Inspect an address's token balances/transfers when debugging.
- Cross-check a `conditionId` / token id from the CLI against onchain reality.

## How

Call the Blockscout MCP tools (transaction by hash, address info, token info/holders, logs) after
restarting Claude Code and running `/mcp` to confirm the server is connected. Always confirm the
**chain** (Polygon for Polymarket's CTF/USDC) and verify token **decimals** before interpreting amounts.

This is read-only debugging support; it is not on the scanner's hot path.
