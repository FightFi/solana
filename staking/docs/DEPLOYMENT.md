# Deployment Guide

This guide covers deploying the staking program to different Solana networks.

## Understanding Program IDs

A **Program ID** is the public key of the keypair used to deploy the program. Anchor automatically generates this keypair on first build.

```
target/deploy/staking-keypair.json  →  Public Key  →  Program ID
```

## Program Keypair Location

```bash
# View your program keypair (NEVER share this file)
cat target/deploy/staking-keypair.json

# View the program ID (public key)
solana-keygen pubkey target/deploy/staking-keypair.json
```

## Network-Specific Builds

The program ID is compiled into the binary using Cargo features:

```bash
# Localnet (default)
anchor build

# Testnet
anchor build -- --features testnet

# Mainnet
anchor build -- --features mainnet
```

## Deployment Steps

### Localnet

```bash
# Start local validator (in separate terminal)
solana-test-validator

# Build and deploy
anchor build
anchor deploy
```

### Testnet

```bash
# 1. Configure CLI for testnet
solana config set --url testnet

# 2. Ensure wallet has SOL (need ~2 SOL for deployment)
solana balance
# If needed: use https://faucet.solana.com (select Testnet)

# 3. Build with testnet feature
anchor build -- --features testnet

# 4. Deploy
anchor deploy --provider.cluster testnet

# 5. (Optional) Upload IDL
anchor idl init <PROGRAM_ID> --filepath target/idl/staking.json --provider.cluster testnet
```

### Mainnet

> ⚠️ **WARNING:** Mainnet deployments use real money. Double-check everything.

#### Option A: Use Same Keypair (Same Program ID)

Uses the same `target/deploy/staking-keypair.json` for all networks.

```bash
# 1. Configure CLI for mainnet
solana config set --url mainnet-beta

# 2. Ensure wallet has SOL (~2 SOL for deployment)
solana balance

# 3. Build with mainnet feature
anchor build -- --features mainnet

# 4. Deploy
anchor deploy --provider.cluster mainnet
```

#### Option B: Create New Keypair (Different Program ID) - Recommended

Separate keypairs per network for added safety.

```bash
# 1. Generate a new keypair for mainnet
solana-keygen new -o target/deploy/staking-mainnet-keypair.json

# 2. View the new program ID
solana-keygen pubkey target/deploy/staking-mainnet-keypair.json
# Output: <YOUR_MAINNET_PROGRAM_ID>

# 3. Update lib.rs with the new mainnet program ID
# Edit the #[cfg(feature = "mainnet")] declare_id!(...) line

# 4. Build with mainnet feature
anchor build -- --features mainnet

# 5. Deploy with the mainnet keypair
anchor deploy --provider.cluster mainnet --program-keypair target/deploy/staking-mainnet-keypair.json
```

## Upgrading a Deployed Program

To upgrade an existing deployment:

```bash
# Upgrade (not deploy) - uses existing program ID
anchor upgrade target/deploy/staking.so --program-id <PROGRAM_ID> --provider.cluster <CLUSTER>
```

## Configuration Files

### Anchor.toml

Different program IDs per network:

```toml
[programs.localnet]
staking = "9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd"

[programs.testnet]
staking = "5HWYY9fuyvCrvV66GCg5hPbf7XARCcybuQrdJGGEbEVH"

[programs.mainnet]
staking = "<YOUR_MAINNET_PROGRAM_ID>"
```

### lib.rs

Program ID selected at compile time:

```rust
#[cfg(feature = "mainnet")]
declare_id!("<YOUR_MAINNET_PROGRAM_ID>");

#[cfg(feature = "testnet")]
declare_id!("5HWYY9fuyvCrvV66GCg5hPbf7XARCcybuQrdJGGEbEVH");

#[cfg(not(any(feature = "mainnet", feature = "testnet")))]
declare_id!("9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd");
```

## Security Checklist

Before mainnet deployment:

- [ ] Audit completed (see [AUDIT_REPORT.md](../reports/AUDIT_REPORT.md))
- [ ] All tests passing
- [ ] Program keypair backed up securely
- [ ] Program keypair NOT committed to git
- [ ] Upgrade authority set correctly
- [ ] Wallet has sufficient SOL for deployment
- [ ] Double-check program ID in lib.rs matches intended deployment

## Backup Your Keypairs

**Critical:** Back up your program keypairs securely. Without them, you cannot upgrade your program.

```bash
# Backup location suggestions:
# - Hardware wallet
# - Encrypted cloud storage
# - Physical secure storage

# Files to backup:
target/deploy/staking-keypair.json      # Localnet/Testnet
target/deploy/staking-mainnet-keypair.json  # Mainnet (if using separate)
```

## Viewing Deployed Programs

```bash
# Check program on explorer
# Testnet: https://explorer.solana.com/address/<PROGRAM_ID>?cluster=testnet
# Mainnet: https://explorer.solana.com/address/<PROGRAM_ID>

# Check program account
solana program show <PROGRAM_ID>
```
