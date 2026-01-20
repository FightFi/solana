# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Solana staking program built with Anchor framework (Rust). Users stake FIGHT tokens (SPL Token) with owner-controlled pause functionality. Migrated from Solidity ERC20 staking contract.

- **Language:** Rust (Anchor v0.32.1), TypeScript (tests)
- **Rust Version:** 1.89.0 (pinned in `rust-toolchain.toml`)
- **FIGHT Token Mint:** `8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU`

### Program IDs

| Network   | Program ID                                       |
|-----------|--------------------------------------------------|
| Localnet  | `9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd`   |
| Testnet   | `DVDvrhK9vFQ8JtXpv3pSskSQahuuQKPuWpJakHT4EJne`   |
| Mainnet   | *Not yet deployed*                               |

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
├── errors.rs           # Custom error codes (see Error Codes section below)
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

- **Cluster:** localnet (default, see `Anchor.toml`)
- **Wallet:** `~/.config/solana/testnet-wallet.json`
- **Test framework:** Mocha + Chai (`tests/staking.ts`)

## Building for Different Networks

Program ID is selected at compile time via Cargo features:

```bash
# Localnet (default)
anchor build

# Testnet
anchor build -- --features testnet

# Mainnet
anchor build -- --features mainnet
```

The `lib.rs` uses conditional compilation to select the correct program ID based on the feature flag.

## Known Issues & Workarounds

### blake3 Version Pin
`blake3` is pinned to `=1.5.5` in `Cargo.toml`. Do not remove this pin. Newer versions pull in `constant_time_eq` v0.4.2 which requires Rust edition 2024, but Solana's `cargo-build-sbf` bundles Rust 1.84.1 which doesn't support it.

### IDL Build Feature
The `idl-build` feature must include `anchor-spl/idl-build`:
```toml
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
```
Without this, IDL generation fails with cryptic errors about missing `DISCRIMINATOR` and `create_type`.

### Test Setup
- Run `yarn install` before `anchor test` to install TypeScript dependencies
- Tests create a mock FIGHT token mint on localnet since the real mint (`8f62NyJG...`) only exists on mainnet/devnet

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | `ContractPaused` | Staking is paused (unstaking still allowed) |
| 6001 | `NotPaused` | Cannot unpause - contract is not paused |
| 6002 | `AlreadyPaused` | Cannot pause - contract is already paused |
| 6003 | `ZeroAmount` | Amount must be greater than zero |
| 6004 | `InsufficientBalance` | User doesn't have enough staked balance |
| 6005 | `Unauthorized` | Only owner can perform this action |
| 6006 | `InvalidTokenMint` | Wrong token mint provided |
| 6007 | `InvalidTokenAccount` | Invalid token account |
| 6008 | `InvalidUser` | User mismatch in UserStake account |
| 6009 | `Overflow` | Arithmetic overflow |
| 6010 | `Underflow` | Arithmetic underflow |

## Events

All events include `timestamp` (i64) and `slot` (u64) fields.

- **Staked:** `user`, `amount`, `user_balance_before`, `user_balance_after`, `total_staked_after`
- **Unstaked:** `user`, `amount`, `user_balance_before`, `user_balance_after`, `total_staked_after`
- **Paused:** emitted when owner pauses contract
- **Unpaused:** emitted when owner unpauses contract

## Reference

Original Solidity contract kept at `staking/staking.sol` for feature parity verification.
