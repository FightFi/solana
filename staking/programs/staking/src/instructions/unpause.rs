use anchor_lang::prelude::*;

use crate::errors::StakingError;
use crate::events::Unpaused;
use super::admin::Admin;

/// Unpause the staking contract (only owner)
pub fn unpause(ctx: Context<Admin>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    require!(state.paused, StakingError::NotPaused);
    state.paused = false;
    
    emit!(Unpaused {
        timestamp: Clock::get()?.unix_timestamp,
        slot: Clock::get()?.slot,
    });
    
    msg!("Contract unpaused");
    Ok(())
}
