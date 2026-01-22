# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Solana staking program built with Anchor framework (Rust). Users stake FIGHT tokens (SPL Token) with owner-controlled pause functionality. Migrated from Solidity ERC20 staking contract.

- **Language:** Rust (Anchor v0.32.1), TypeScript (tests)
- **Rust Version:** 1.89.0 (pinned in `rust-toolchain.toml`)

### Program IDs & Token Addresses

| Network   | Program ID                                       | FIGHT Token Mint                                 |
|-----------|--------------------------------------------------|--------------------------------------------------|
| Devnet    | `DVDvrhK9vFQ8JtXpv3pSskSQahuuQKPuWpJakHT4EJne`   | `H5HwNswMvoHXHXqYuk1BkxXaiC3azj8gjy7qhwsdQLDt`   |
| Testnet   | `DVDvrhK9vFQ8JtXpv3pSskSQahuuQKPuWpJakHT4EJne`   | `ATQgP3cCA6srjsXe5wLXQPAHzimi2tSJ7GhH8MXJgYNE`   |
| Mainnet   | *Not yet deployed*                               | *Not yet deployed*                               |

> **Note:** Program ID is the same on devnet and testnet (same keypair used for deployment).

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
- Tests always create a fresh mock FIGHT token mint (the mint address is passed at `initialize` time, not hardcoded)

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

## Frontend Integration (FightFi PWA)

The Solana staking program is integrated into the FightFi PWA at `/Users/aukaitirrell/Projects/FightFi-Web/apps/fightfi-pwa`.

### Key Files

| File | Purpose |
|------|---------|
| `src/common/components/solana/solana-wallet-provider.tsx` | Wraps app with Solana wallet adapter (ConnectionProvider + WalletProvider) |
| `src/common/hooks/use-solana-staking.tsx` | Hook for stake/unstake operations via Anchor |
| `src/common/hooks/use-solana-fight-balance.tsx` | Hook for user's FIGHT token balance |
| `src/common/config/solana.config.ts` | Network config (program ID, mint address, RPC endpoint) |
| `src/common/idl/staking.json` | Program IDL (copy from `staking/target/idl/staking.json`) |
| `src/common/idl/staking.ts` | TypeScript types (copy from `staking/target/types/staking.ts`) |
| `src/modules/(quest)/stake-fight/components/stake-interface.tsx` | Main staking UI (supports both Solana and BSC) |
| `src/modules/(quest)/stake-fight/components/unstake-modal.tsx` | Unstake modal (supports both chains) |

### Wallet Support

The app uses Solana Wallet Adapter with `autoConnect: true`:
- **Phantom** - via `PhantomWalletAdapter`
- **Solflare** - via `SolflareWalletAdapter`
- **Backpack** - auto-detected via Wallet Standard
- **OKX** - auto-detected via Wallet Standard

### Architecture

```
App.tsx
└── SolanaWalletProvider (ConnectionProvider + WalletProvider)
    └── Components using useWallet(), useSolanaStaking(), etc.
```

The staking interface (`stake-interface.tsx`) supports both chains:
- **BSC**: Uses `useRainbowStaking` + wagmi
- **Solana**: Uses `useSolanaStaking` + Solana wallet adapter

Reward data comes from a shared backend API (`useGetStakingRewardQuery`) for both chains.

### Updating the IDL

After modifying the Solana program:
1. Run `anchor build` in `staking/`
2. Copy `target/idl/staking.json` → PWA's `src/common/idl/staking.json`
3. Copy `target/types/staking.ts` → PWA's `src/common/idl/staking.ts`

### Environment Variables (PWA)

```env
SOLANA_NETWORK=testnet  # or mainnet
SOLANA_TESTNET_PROGRAM_ID=DVDvrhK9vFQ8JtXpv3pSskSQahuuQKPuWpJakHT4EJne
SOLANA_TESTNET_FIGHT_MINT_ADDRESS=ATQgP3cCA6srjsXe5wLXQPAHzimi2tSJ7GhH8MXJgYNE
SOLANA_TESTNET_RPC_ENDPOINT=https://api.testnet.solana.com
```

## Reference

Original Solidity contract kept at `staking/staking.sol` for feature parity verification.
