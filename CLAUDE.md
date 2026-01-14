# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Solana staking program built with Anchor framework (Rust). Users stake FIGHT tokens (SPL Token) with owner-controlled pause functionality. Migrated from Solidity ERC20 staking contract.

- **Language:** Rust (Anchor v0.32.1), TypeScript (tests)
- **Rust Version:** 1.89.0 (pinned in `rust-toolchain.toml`)
- **Program ID:** `9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd`
- **FIGHT Token Mint:** `8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU`

## Commands

All commands run from `staking/` directory:

```bash
# Run tests (via Anchor)
anchor test
# Or directly:
yarn run ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"

# Build program
anchor build

# Lint/format (Prettier for JS/TS files)
yarn run lint          # Check formatting
yarn run lint:fix      # Auto-fix formatting
```

## Architecture

```
staking/programs/staking/src/
├── lib.rs              # Program entry - dispatches to instruction handlers
├── constants.rs        # PDA seeds, account sizes, FIGHT mint address
├── errors.rs           # Custom error codes (ContractPaused, InsufficientBalance, etc.)
├── events.rs           # On-chain events (Staked, Unstaked, Paused, Unpaused)
├── state/
│   ├── state.rs        # Global State account (mint, owner, total_staked, paused)
│   └── user_stake.rs   # Per-user UserStake account (user, balance)
└── instructions/
    ├── initialize.rs   # Create State and vault token account
    ├── stake.rs        # Transfer tokens user→vault, update balances
    ├── unstake.rs      # Transfer tokens vault→user, update balances
    ├── pause.rs        # Owner-only: pause staking
    ├── unpause.rs      # Owner-only: resume staking
    └── admin.rs        # Admin context for owner-only operations
```

### PDA Derivation

- **State:** `["state"]` - single global account
- **Vault:** `["vault", mint_pubkey]` - token account holding staked tokens
- **UserStake:** `["user_stake", user_pubkey]` - per-user balance tracking

### Token Flow

- **Stake:** User signs CPI transfer from user_token_account → vault
- **Unstake:** Vault PDA signs CPI transfer from vault → user_token_account (via `CpiContext::new_with_signer`)

## Adding New Instructions

1. Create handler in `instructions/` with context struct (`#[derive(Accounts)]`)
2. Export from `instructions/mod.rs`
3. Add dispatch method in `lib.rs`
4. Add tests in `tests/staking.ts`
5. Add error codes in `errors.rs` if needed

## Configuration

- **Cluster:** localnet (see `Anchor.toml`)
- **Wallet:** `~/.config/solana/id.json`
- **Test framework:** Mocha + Chai (`tests/staking.ts`)

## Reference

Original Solidity contract kept at `staking/staking.sol` for feature parity verification.
