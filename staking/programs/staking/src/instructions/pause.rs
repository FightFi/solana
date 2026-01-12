use anchor_lang::prelude::*;

use crate::errors::StakingError;
use crate::events::Paused;
use super::admin::Admin;

/// Pause the staking contract (only owner)
pub fn pause(ctx: Context<Admin>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    require!(!state.paused, StakingError::AlreadyPaused);
    state.paused = true;
    
    emit!(Paused {
        timestamp: Clock::get()?.unix_timestamp,
        slot: Clock::get()?.slot,
    });
    
    msg!("Contract paused");
    Ok(())
}
