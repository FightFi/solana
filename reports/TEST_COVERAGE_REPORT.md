# Test Coverage Report

**Date:** 2025-01-14
**File:** `staking/tests/staking.ts`

## Summary

Added 9 new tests to improve coverage from 7 to 16 tests. The new tests focus on security-critical paths, error handling, and multi-user scenarios that were previously untested.

---

## Why These Tests Were Needed

### Security Gap: Unstake While Paused

The most critical missing test. The Solidity contract explicitly allows unstaking when paused (`unstake` has no `whenNotPaused` modifier). This is a **user safety feature** - during an emergency (exploit, bug discovery), users must be able to withdraw their funds.

Without this test, we couldn't verify that the Solana implementation preserves this behavior. If unstaking was accidentally blocked during pause, users could lose access to their funds during emergencies.

### Authorization Tests Missing

No tests verified that only the owner can pause/unpause. An attacker could potentially:
- Pause the contract to grief users (block new stakes)
- Unpause during a legitimate emergency

These tests ensure the `Unauthorized` error fires correctly.

### Error Paths Untested

The contract has specific error codes (`ZeroAmount`, `AlreadyPaused`, `NotPaused`) that were never exercised in tests. Untested code paths are potential bug hiding spots.

### Multi-User Scenarios

Original tests only used `user1`. Real usage involves many users staking/unstaking. We needed to verify:
- `total_staked` aggregates correctly across users
- One user's actions don't affect another's balance
- Edge case: withdrawing entire balance works

---

## New Tests Added

### Security Tests (Critical)

| Test | What it Verifies | Why it Matters |
|------|------------------|----------------|
| `Allows unstaking while paused` | Users can withdraw when contract is paused | **User fund safety** - funds never locked |
| `Fails when non-owner tries to pause` | Only owner can pause | Prevents griefing attacks |
| `Fails when non-owner tries to unpause` | Only owner can unpause | Prevents bypassing emergency stops |

### Error Path Tests

| Test | Error Code | What it Verifies |
|------|------------|------------------|
| `Fails to stake zero amount` | `ZeroAmount` | Rejects meaningless transactions |
| `Fails to unstake zero amount` | `ZeroAmount` | Rejects meaningless transactions |
| `Fails to pause when already paused` | `AlreadyPaused` | State consistency check |
| `Fails to unpause when not paused` | `NotPaused` | State consistency check |

### Functional Tests

| Test | What it Verifies |
|------|------------------|
| `Tracks total_staked correctly with multiple users` | Aggregate accounting works; user balances isolated |
| `Allows full unstake (withdraw entire balance)` | Edge case: balance can reach exactly 0 |

---

## Test Coverage Matrix

### Instructions

| Instruction | Happy Path | Error Paths | Auth Check |
|-------------|------------|-------------|------------|
| `initialize` | ✅ | - | - |
| `stake` | ✅ | ✅ ZeroAmount, ✅ ContractPaused | - |
| `unstake` | ✅ | ✅ ZeroAmount, ✅ InsufficientBalance | - |
| `pause` | ✅ | ✅ AlreadyPaused | ✅ Unauthorized |
| `unpause` | ✅ | ✅ NotPaused | ✅ Unauthorized |

### Scenarios

| Scenario | Tested |
|----------|--------|
| Single user stake/unstake | ✅ |
| Multiple users | ✅ |
| Partial unstake | ✅ |
| Full unstake (balance → 0) | ✅ |
| Unstake while paused | ✅ |
| Stake while paused | ✅ (should fail) |

---

## Test Execution Order

Tests run sequentially and share state. The order matters:

```
1.  Initialize program
2.  Stakes tokens (user1: +1000)
3.  Unstakes tokens (user1: -500, balance: 500)
4.  Pauses the contract
5.  Fails to stake when paused
6.  Unpauses the contract
7.  Fails to unstake more than balance
8.  Allows unstaking while paused (user1: -100, balance: 400)
9.  Fails when non-owner tries to pause
10. Fails when non-owner tries to unpause
11. Fails to stake zero amount
12. Fails to unstake zero amount
13. Fails to pause when already paused
14. Fails to unpause when not paused
15. Tracks total_staked with multiple users (user2: +500)
16. Allows full unstake (user2: -500, balance: 0)
```

Final state after all tests:
- `user1.balance`: 400 tokens
- `user2.balance`: 0 tokens
- `total_staked`: 400 tokens
- `paused`: false

---

## Remaining Coverage Gaps

These scenarios are NOT tested but may be worth adding later:

1. **Wrong token mint** - Passing a different SPL token (requires creating second mint)
2. **Re-initialization attack** - Attempting to call `initialize` twice
3. **Arithmetic overflow** - Staking amounts that would overflow `u64`
4. **Concurrent transactions** - Race conditions (hard to test deterministically)
5. **Event emission** - Verifying correct event data (requires transaction log parsing)

---

## How to Run Tests

```bash
cd staking

# Option 1: Let Anchor manage validator
anchor test

# Option 2: Use existing validator
solana-test-validator  # in separate terminal
anchor test --skip-local-validator
```

Expected output: **16 passing tests**
