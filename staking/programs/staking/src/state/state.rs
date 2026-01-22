use anchor_lang::prelude::*;
use crate::constants::STATE_LEN;

/// State account - stores program configuration
#[account]
#[derive(Default)]
pub struct State {
    pub fight_token_mint: Pubkey,      // FIGHT token mint address
    pub owner: Pubkey,                 // Program owner
    pub vault_token_account: Pubkey,   // Canonical vault token account [L-3]
    pub total_staked: u64,             // Total amount staked
    pub paused: bool,                  // Pause state
    pub bump: u8,                      // Bump seed for state PDA
}

impl State {
    pub const LEN: usize = STATE_LEN;
}
