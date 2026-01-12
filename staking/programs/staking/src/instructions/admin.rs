use anchor_lang::prelude::*;

use crate::state::State;
use crate::errors::StakingError;
use crate::constants::seeds;

/// Admin context for owner-only operations
#[derive(Accounts)]
pub struct Admin<'info> {
    #[account(
        mut,
        seeds = [seeds::STATE],
        bump = state.bump,
        constraint = state.owner == admin.key() @ StakingError::Unauthorized
    )]
    pub state: Account<'info, State>,
    
    pub admin: Signer<'info>,
}
