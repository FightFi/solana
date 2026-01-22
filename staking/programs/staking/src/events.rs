use anchor_lang::prelude::*;

/// Event emitted when program is initialized [I-5]
#[event]
pub struct Initialized {
    pub owner: Pubkey,
    pub fight_token_mint: Pubkey,
    pub vault_authority: Pubkey,
    pub vault_token_account: Pubkey,
    pub timestamp: i64,
    pub slot: u64,
}

/// Event emitted when tokens are staked
#[event]
pub struct Staked {
    pub user: Pubkey,
    pub amount: u64,
    pub user_balance_before: u64,
    pub user_balance_after: u64,
    pub total_staked_after: u64,
    pub timestamp: i64,
    pub slot: u64,
}

/// Event emitted when tokens are unstaked
#[event]
pub struct Unstaked {
    pub user: Pubkey,
    pub amount: u64,
    pub user_balance_before: u64,
    pub user_balance_after: u64,
    pub total_staked_after: u64,
    pub timestamp: i64,
    pub slot: u64,
}

/// Event emitted when contract is paused
#[event]
pub struct Paused {
    pub timestamp: i64,
    pub slot: u64,
}

/// Event emitted when contract is unpaused
#[event]
pub struct Unpaused {
    pub timestamp: i64,
    pub slot: u64,
}
