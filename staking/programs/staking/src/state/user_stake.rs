use anchor_lang::prelude::*;
use crate::constants::USER_STAKE_LEN;

/// User stake account - stores individual user balance
#[account]
#[derive(Default)]
pub struct UserStake {
    pub user: Pubkey,   // User address
    pub balance: u64,   // Staked balance
    pub bump: u8,       // Bump seed for user stake PDA
}

impl UserStake {
    pub const LEN: usize = USER_STAKE_LEN;
}
