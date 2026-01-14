# FIGHT Token Staking Program

A Solana staking program built with Anchor framework. Users can stake FIGHT tokens (SPL Token) with owner-controlled pause functionality.

## Prerequisites

- [Rust](https://rustup.rs/) (1.89.0 recommended)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (3.0+)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (0.32.1)
- [Node.js](https://nodejs.org/) (18+)
- [Yarn](https://yarnpkg.com/)

## Setup

```bash
cd staking

# Generate a Solana keypair (if you don't have one)
solana-keygen new -o ~/.config/solana/id.json

# Install TypeScript dependencies
yarn install
```

## Build

```bash
cd staking
anchor build
```

## Test

```bash
cd staking
anchor test
```

This will:
1. Build the Rust program
2. Start a local Solana validator
3. Deploy the program
4. Run all 16 integration tests

### Run Tests Directly

If a local validator is already running:

```bash
cd staking
yarn run ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

## Lint

```bash
cd staking
yarn run lint          # Check formatting
yarn run lint:fix      # Auto-fix formatting
```

## Program Architecture

```
staking/programs/staking/src/
├── lib.rs              # Program entry point
├── constants.rs        # PDA seeds, account sizes
├── errors.rs           # Custom error codes
├── events.rs           # On-chain events
├── state/
│   ├── state.rs        # Global State account
│   └── user_stake.rs   # Per-user UserStake account
└── instructions/
    ├── initialize.rs   # Create State and vault
    ├── stake.rs        # Stake tokens
    ├── unstake.rs      # Unstake tokens
    ├── pause.rs        # Pause staking (owner only)
    └── unpause.rs      # Resume staking (owner only)
```

## Key Features

- **Stake/Unstake:** Users can stake and unstake FIGHT tokens at any time
- **Pause Control:** Owner can pause staking (unstaking always allowed for user safety)
- **PDA Vaults:** Tokens held in program-controlled vault accounts
- **Per-user Tracking:** Individual stake balances tracked via UserStake PDAs

## Program ID

```
9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd
```

## FIGHT Token Mint

```
8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU
```
