-- ethfund: strike ("price to beat") context on pair snapshots.
-- Each ETH Up/Down market resolves vs the Chainlink ETH/USD price at ITS OWN window start,
-- so two same-expiry markets have different strikes. Persist the strikes and the live spot
-- alongside each compared pair — needed to backtest strike-aware (less rigid) signal logic.
-- Values are sourced from Pyth Hermes (display-grade; resolution uses Chainlink streams).

alter table public.pair_snapshots add column if not exists price_to_beat_a numeric;
alter table public.pair_snapshots add column if not exists price_to_beat_b numeric;
alter table public.pair_snapshots add column if not exists eth_spot        numeric;
