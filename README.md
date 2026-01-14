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

## Deployment

### Localnet (default)
```bash
cd staking
anchor test  # Builds, deploys, and tests automatically
```

### Devnet
```bash
cd staking
solana config set --url devnet
anchor build
anchor deploy --provider.cluster devnet
```

### Mainnet
```bash
cd staking
solana config set --url mainnet-beta
anchor build
anchor deploy --provider.cluster mainnet
```

## PDA Derivation

For client integration, derive PDAs as follows:

| Account | Seeds | Description |
|---------|-------|-------------|
| **State** | `["state"]` | Global program state (singleton) |
| **Vault** | `["vault", mint_pubkey]` | Token account holding staked tokens |
| **UserStake** | `["user_stake", user_pubkey]` | Per-user stake balance |

### JavaScript Example

```typescript
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("<PROGRAM_ID>");
const FIGHT_MINT = new PublicKey("<FIGHT_TOKEN_MINT>");

// State PDA
const [statePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("state")],
  PROGRAM_ID
);

// Vault PDA
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), FIGHT_MINT.toBuffer()],
  PROGRAM_ID
);

// User Stake PDA
const [userStakePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("user_stake"), userPublicKey.toBuffer()],
  PROGRAM_ID
);
```

## Client Usage

### Stake Tokens

```typescript
import { Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const userTokenAccount = await getAssociatedTokenAddress(FIGHT_MINT, userPublicKey);

await program.methods
  .stake(new BN(1000 * 10 ** 9)) // 1000 tokens (9 decimals)
  .accounts({
    state: statePda,
    userStake: userStakePda,
    user: userPublicKey,
    userTokenAccount: userTokenAccount,
    vaultAuthority: vaultPda,
    vaultTokenAccount: vaultTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### Unstake Tokens

```typescript
await program.methods
  .unstake(new BN(500 * 10 ** 9)) // 500 tokens
  .accounts({
    state: statePda,
    userStake: userStakePda,
    user: userPublicKey,
    userTokenAccount: userTokenAccount,
    vaultAuthority: vaultPda,
    vaultTokenAccount: vaultTokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

### Read User Balance

```typescript
const userStake = await program.account.userStake.fetch(userStakePda);
console.log("Staked balance:", userStake.balance.toNumber());
```

## Program ID

```
9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd
```

## FIGHT Token Mint

```
8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU
```

## Security

This program has been audited. See [AUDIT_REPORT.md](./reports/AUDIT_REPORT.md) for details.

Key security features:
- Users can always unstake even when contract is paused
- Owner-only pause/unpause controls
- Zero-amount transactions rejected
- Insufficient balance checks on unstake

## Test Coverage

See [TEST_COVERAGE_REPORT.md](./reports/TEST_COVERAGE_REPORT.md) for detailed test coverage analysis.

The test suite includes 16 integration tests covering:
- Core functionality (initialize, stake, unstake)
- Pause/unpause controls
- Authorization checks
- Error handling (zero amounts, insufficient balance)
- Edge cases (multi-user, full withdrawal)

## Documentation

- [Token Setup Guide](./staking/docs/TOKEN_SETUP.md) - CLI instructions for creating tokens, minting, and setup

## License

MIT
