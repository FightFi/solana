# Mainnet Deployment Guide

## Overview

This document outlines the complete deployment process for the FIGHT Token Staking program to Solana Mainnet.

---

## Configuration Summary

| Item | Value |
|------|-------|
| **Program ID** | `4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc` |
| **FIGHT Token Mint** | `8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU` |
| **Owner Wallet** | `65mxnibS4DL2qqL24GpMJqtNxgEzWgnARTMvXv5SePUb` |
| **Program Keypair** | `target/deploy/staking-mainnet-keypair.json` |
| **Owner Wallet File** | `~/.config/solana/mainnet-wallet.json` |

---

## Pre-Deployment Checklist

- [x] Mainnet wallet created and funded (~3 SOL)
- [x] Mainnet program keypair generated
- [x] `lib.rs` updated with mainnet program ID
- [x] `constants.rs` updated with mainnet EXPECTED_OWNER
- [x] `Anchor.toml` updated with mainnet config
- [x] `CLAUDE.md` updated with mainnet info
- [ ] Build with mainnet feature
- [ ] Deploy program
- [ ] Upload IDL metadata
- [ ] Initialize program

---

## Step 1: Build Program

Build the program with the mainnet feature flag to compile with the correct program ID and owner validation.

```bash
cd /Users/aukaitirrell/Projects/solana/staking

# Build with mainnet feature
anchor build -- --features mainnet
```

**Verify the IDL has the correct program ID:**
```bash
head -3 target/idl/staking.json
# Should show: "address": "4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc"
```

---

## Step 2: Deploy Program

Deploy the compiled program to Solana Mainnet using the mainnet program keypair.

```bash
# Deploy to mainnet
solana program deploy target/deploy/staking.so \
  --program-id target/deploy/staking-mainnet-keypair.json \
  --url mainnet-beta \
  --keypair ~/.config/solana/mainnet-wallet.json
```

**Expected output:**
```
Program Id: 4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc
Signature: <transaction_signature>
```

**Verify deployment:**
```bash
solana program show 4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc --url mainnet-beta
```

---

## Step 3: Upload IDL Metadata

Upload the IDL to the blockchain for easier program interaction and verification.

```bash
# Initialize IDL account (first time only)
anchor idl init 4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc \
  --filepath target/idl/staking.json \
  --provider.cluster mainnet \
  --provider.wallet ~/.config/solana/mainnet-wallet.json
```

**To update IDL later (if program is upgraded):**
```bash
anchor idl upgrade 4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc \
  --filepath target/idl/staking.json \
  --provider.cluster mainnet \
  --provider.wallet ~/.config/solana/mainnet-wallet.json
```

---

## Step 4: Initialize Program

Initialize the staking program with the mainnet FIGHT token mint. This creates:
- State account (global program configuration)
- Vault token account (holds staked tokens)

### Option A: Using a Script

Create and run an initialization script:

```bash
npx ts-node scripts/initialize-mainnet.ts
```

### Option B: Manual Initialization

```typescript
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";

const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const PROGRAM_ID = new PublicKey("4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc");
const FIGHT_MINT = new PublicKey("8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU");

// Load wallet
const walletPath = os.homedir() + "/.config/solana/mainnet-wallet.json";
const wallet = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
);

// Initialize
const tx = await program.methods
  .initialize()
  .accountsPartial({
    fightTokenMint: FIGHT_MINT,
    payer: wallet.publicKey,
  })
  .rpc();
```

---

## Step 5: Verify Initialization

After initialization, verify the state account was created correctly:

```bash
# Check state account exists
solana account <STATE_PDA> --url mainnet-beta
```

Or programmatically:

```typescript
const [statePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("state")],
  PROGRAM_ID
);

const state = await program.account.state.fetch(statePda);
console.log("Owner:", state.owner.toBase58());
console.log("FIGHT Mint:", state.fightTokenMint.toBase58());
console.log("Vault:", state.vaultTokenAccount.toBase58());
console.log("Total Staked:", state.totalStaked.toString());
console.log("Paused:", state.paused);
```

---

## Post-Deployment

### Update Frontend

1. Update environment variables:
   ```env
   VITE_SOLANA_NETWORK=mainnet-beta
   VITE_APP_FIGHT_TOKEN_SOLANA=8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU
   ```

2. Update `solana.helpers.ts` with mainnet program ID (if not already):
   ```typescript
   const STAKING_PROGRAM_IDS: Record<string, string> = {
     "mainnet-beta": "4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc",
     // ...
   };
   ```

3. Copy updated IDL to frontend:
   ```bash
   cp target/idl/staking.json /path/to/frontend/src/common/idl/staking.json
   cp target/types/staking.ts /path/to/frontend/src/common/idl/staking.ts
   ```

### Verify on Explorer

- **Program**: https://explorer.solana.com/address/4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc
- **FIGHT Token**: https://explorer.solana.com/address/8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU

---

## Security Notes

1. **Keypair Backup**: Ensure both keypairs are backed up securely:
   - `~/.config/solana/mainnet-wallet.json` (owner wallet)
   - `target/deploy/staking-mainnet-keypair.json` (program upgrade authority)

2. **Owner Privileges**: The owner wallet can:
   - Pause/unpause the staking contract
   - No ability to withdraw user funds (by design)

3. **Upgrade Authority**: The program can be upgraded using the mainnet wallet. Consider:
   - Transferring to a multisig for additional security
   - Or making the program immutable after thorough testing

---

## Rollback Procedure

If issues are discovered after deployment:

1. **Pause the contract** (prevents new stakes):
   ```typescript
   await program.methods.pause().accounts({ admin: ownerWallet }).rpc();
   ```

2. **Users can still unstake** even when paused

3. **Deploy fix and upgrade**:
   ```bash
   anchor build -- --features mainnet
   solana program deploy target/deploy/staking.so \
     --program-id 4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc \
     --url mainnet-beta \
     --keypair ~/.config/solana/mainnet-wallet.json
   ```

---

## Command Summary

```bash
# 1. Build
anchor build -- --features mainnet

# 2. Deploy
solana program deploy target/deploy/staking.so \
  --program-id target/deploy/staking-mainnet-keypair.json \
  --url mainnet-beta \
  --keypair ~/.config/solana/mainnet-wallet.json

# 3. Upload IDL
anchor idl init 4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc \
  --filepath target/idl/staking.json \
  --provider.cluster mainnet \
  --provider.wallet ~/.config/solana/mainnet-wallet.json

# 4. Initialize (via script)
npx ts-node scripts/initialize-mainnet.ts

# 5. Verify
solana program show 4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc --url mainnet-beta
```
