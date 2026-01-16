# Token Setup Guide

This guide walks you through creating a new SPL token, setting up a token account, and minting tokens using the Solana CLI.

## Prerequisites

- Solana CLI installed (`solana --version`)
- SPL Token CLI installed (`spl-token --version`)
- A funded wallet (SOL for transaction fees)

## 1. Configure Your Network

```bash
# Set network (testnet, devnet, or mainnet-beta)
solana config set --url testnet

# Verify configuration
solana config get

# Check your wallet balance (need SOL for fees)
solana balance
```

## 2. Create a New Token (Mint)

```bash
# Create a new token with 9 decimals (standard for most tokens)
spl-token create-token --decimals 9
```

**Output:**
```
Creating token <MINT_ADDRESS>
Address:  <MINT_ADDRESS>
Decimals: 9

Signature: <TX_SIGNATURE>
```

**Save the `<MINT_ADDRESS>`** - you'll need it for all following steps.

### What This Does
- Creates a new **Mint Account** on-chain
- You (your wallet) become the **Mint Authority** (can mint new tokens)
- You also become the **Freeze Authority** (can freeze accounts)

## 3. Create Your Token Account

Before you can hold tokens, you need a **Token Account** for that specific mint.

```bash
# Create a token account for your wallet
spl-token create-account <MINT_ADDRESS>
```

**Output:**
```
Creating account <TOKEN_ACCOUNT_ADDRESS>
Signature: <TX_SIGNATURE>
```

### What This Does
- Creates an **Associated Token Account (ATA)** for your wallet
- This account will hold your balance of this specific token
- The ATA address is deterministically derived from your wallet + mint

## 4. Mint Tokens

Now mint tokens to your account:

```bash
# Mint 10,000 tokens to yourself
spl-token mint <MINT_ADDRESS> 10000
```

**Output:**
```
Minting 10000 tokens
  Token: <MINT_ADDRESS>
  Recipient: <TOKEN_ACCOUNT_ADDRESS>

Signature: <TX_SIGNATURE>
```

### Mint Different Amounts

```bash
# Mint 1,000,000 tokens
spl-token mint <MINT_ADDRESS> 1000000

# Mint with specific decimals (e.g., 100.5 tokens)
spl-token mint <MINT_ADDRESS> 100.5
```

## 5. Verify Your Setup

### Check Token Balance

```bash
# Check balance of a specific token
spl-token balance <MINT_ADDRESS>

# Check all token balances
spl-token accounts
```

### View Token/Account Info

```bash
# View mint info (supply, decimals, authorities)
spl-token display <MINT_ADDRESS>

# View your token account info
spl-token account-info <TOKEN_ACCOUNT_ADDRESS>
```

## 6. Optional: Transfer Tokens

```bash
# Transfer tokens to another wallet
spl-token transfer <MINT_ADDRESS> <AMOUNT> <RECIPIENT_WALLET_ADDRESS>

# Transfer with auto-creation of recipient's token account
spl-token transfer <MINT_ADDRESS> <AMOUNT> <RECIPIENT_WALLET_ADDRESS> --fund-recipient
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `spl-token create-token --decimals 9` | Create new token mint |
| `spl-token create-account <MINT>` | Create token account for mint |
| `spl-token mint <MINT> <AMOUNT>` | Mint tokens to your account |
| `spl-token balance <MINT>` | Check token balance |
| `spl-token accounts` | List all token accounts |
| `spl-token display <MINT>` | View mint info |
| `spl-token transfer <MINT> <AMT> <TO>` | Transfer tokens |

## Example: Full Setup Flow

```bash
# 1. Configure network
solana config set --url testnet

# 2. Check you have SOL for fees
solana balance

# 3. Create the token
spl-token create-token --decimals 9
# Output: Address: ABC123... (save this!)

# 4. Create your token account
spl-token create-account ABC123...

# 5. Mint 10,000 tokens
spl-token mint ABC123... 10000

# 6. Verify
spl-token balance ABC123...
# Output: 10000
```

## Troubleshooting

### "Insufficient funds"
```bash
# Get testnet SOL from faucet
solana airdrop 1
# Or use https://faucet.solana.com
```

### "Account not found"
```bash
# Create the token account first
spl-token create-account <MINT_ADDRESS>
```

### "Mint authority mismatch"
Only the mint authority (token creator) can mint new tokens. Check with:
```bash
spl-token display <MINT_ADDRESS>
```

## Next Steps

After setting up your token, update your `.env` file:

```bash
FIGHT_TOKEN_MINT=<YOUR_MINT_ADDRESS>
```

Then run the staking demo:

```bash
npx ts-node scripts/testnet-demo.ts
```
