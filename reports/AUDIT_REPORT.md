# Staking Program Audit Report

**Date:** 2025-01-14
**Auditor:** Claude Code
**Scope:** `staking/programs/staking/src/`

## Summary

Audited the Solana staking program (Anchor) for correctness against the original Solidity implementation. Found 5 critical issues that would cause compilation/runtime failures, all now fixed.

---

## Critical Issues (Fixed)

### 1. Missing `mut` on State account in `stake.rs`

**Location:** `stake.rs:66-70`

**Problem:** The `state` account was not marked as mutable, but the instruction modifies `state.total_staked`. This would fail at runtime when trying to persist changes.

**Before:**
```rust
#[account(
    seeds = [seeds::STATE],
    bump = state.bump
)]
pub state: Account<'info, State>,
```

**After:**
```rust
#[account(
    mut,
    seeds = [seeds::STATE],
    bump = state.bump
)]
pub state: Account<'info, State>,
```

---

### 2. Missing `mut` on State account in `unstake.rs`

**Location:** `unstake.rs:65-69`

**Problem:** Same issue as #1 - state modifications would fail without `mut`.

**Fix:** Added `mut` attribute to state account.

---

### 3. Wrong constraint on `vault_token_account` in `stake.rs` and `unstake.rs`

**Location:** `stake.rs:91-96`, `unstake.rs:89-94`

**Problem:** The vault_token_account used PDA seeds `["vault", mint]` which derives the **vault_authority** address, not the token account address. The vault_token_account is an Associated Token Account (ATA) created in initialize, with a different derivation.

**Before:**
```rust
#[account(
    mut,
    seeds = [seeds::VAULT, state.fight_token_mint.as_ref()],
    bump
)]
pub vault_token_account: Account<'info, TokenAccount>,

/// CHECK: Vault authority PDA
#[account(
    seeds = [seeds::VAULT, state.fight_token_mint.as_ref()],
    bump
)]
pub vault_authority: AccountInfo<'info>,
```

**After:**
```rust
/// CHECK: Vault authority PDA
#[account(
    seeds = [seeds::VAULT, state.fight_token_mint.as_ref()],
    bump
)]
pub vault_authority: AccountInfo<'info>,

#[account(
    mut,
    constraint = vault_token_account.mint == state.fight_token_mint @ StakingError::InvalidTokenMint,
    constraint = vault_token_account.owner == vault_authority.key() @ StakingError::InvalidTokenAccount,
)]
pub vault_token_account: Account<'info, TokenAccount>,
```

This validates that the token account's mint and owner match expected values.

---

### 4. No validation of `fight_token_mint` in `initialize.rs`

**Location:** `initialize.rs:39-40`

**Problem:** The mint was declared as `AccountInfo` with a comment claiming validation happens, but no validation existed. Any arbitrary account could be passed.

**Before:**
```rust
/// CHECK: We validate this is the correct mint in the instruction
pub fight_token_mint: AccountInfo<'info>,
```

**After:**
```rust
pub fight_token_mint: Account<'info, Mint>,
```

Anchor now automatically validates this is a valid SPL Token Mint account.

---

### 5. Missing `init-if-needed` feature in `Cargo.toml`

**Location:** `programs/staking/Cargo.toml:23-24`

**Problem:** The `stake.rs` uses `init_if_needed` attribute which requires the `init-if-needed` cargo feature to be enabled. Without this, compilation fails.

**Before:**
```toml
[dependencies]
anchor-lang = "0.32.1"
```

**After:**
```toml
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
```

---

## Medium Issues (Not Fixed - Design Decisions)

### 6. No ownership transfer mechanism

The Solidity contract uses `Ownable2Step` for secure two-step ownership transfer. The Solana version has no way to change owner after initialization.

**Recommendation:** Consider adding `transfer_ownership` and `accept_ownership` instructions if owner rotation is required.

### 7. Unstake allowed when paused

Both Solidity and Solana versions allow unstaking when the contract is paused. This is **correct parity** - users can always withdraw their funds even during emergencies.

---

## Feature Parity Check

| Feature | Solidity | Solana | Status |
|---------|----------|--------|--------|
| Stake tokens | Yes | Yes | Matching |
| Unstake tokens | Yes | Yes | Matching |
| Pause/unpause | Yes | Yes | Matching |
| Pause blocks stake | Yes | Yes | Matching |
| Unstake works when paused | Yes | Yes | Matching |
| Event emission | Yes | Yes | Matching |
| Owner-only pause | Yes | Yes | Matching |
| Ownership transfer | Yes (2-step) | No | Gap |
| Zero amount check | Yes | Yes | Matching |
| Balance check on unstake | Yes | Yes | Matching |
| Reentrancy protection | Yes (modifier) | Yes (Anchor) | Matching |
| Overflow protection | Yes (Solidity 0.8+) | Yes (checked_add/sub) | Matching |

---

## Files Changed

1. `staking/programs/staking/src/instructions/stake.rs`
   - Added `mut` to state account
   - Fixed vault_token_account constraint to validate mint and owner manually
   - Reordered accounts (vault_authority before vault_token_account)

2. `staking/programs/staking/src/instructions/unstake.rs`
   - Added `mut` to state account
   - Fixed vault_token_account constraint to validate mint and owner manually
   - Reordered accounts (vault_authority before vault_token_account)

3. `staking/programs/staking/src/instructions/initialize.rs`
   - Changed `fight_token_mint` from `AccountInfo` to `Account<'info, Mint>`

4. `staking/programs/staking/Cargo.toml`
   - Enabled `init-if-needed` feature for anchor-lang (required for `init_if_needed` in stake.rs)

5. `staking/tests/staking.ts`
   - Reordered accounts to match new struct order (vault_authority before vault_token_account)

---

## Verification

Run the test suite to verify fixes:

```bash
cd staking
anchor test
```

All tests should pass after these changes.
