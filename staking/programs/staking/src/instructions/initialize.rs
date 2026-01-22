use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use anchor_spl::token::Token;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::TokenAccount;
use std::str::FromStr;

use crate::state::State;
use crate::constants::{seeds, EXPECTED_OWNER};
use crate::errors::StakingError;
use crate::events::Initialized;

/// Initialize the staking program
/// Sets up the state account with the FIGHT token mint and owner
/// Creates the vault token account for storing staked tokens
///
/// Security: Validates payer matches hardcoded EXPECTED_OWNER to prevent front-running.
/// This addresses audit finding [L-2] and [I-3].
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    // Validate payer is the expected owner to prevent front-running [L-2]
    let expected_owner = Pubkey::from_str(EXPECTED_OWNER)
        .map_err(|_| StakingError::Unauthorized)?;
    require!(
        ctx.accounts.payer.key() == expected_owner,
        StakingError::Unauthorized
    );

    let state = &mut ctx.accounts.state;
    state.fight_token_mint = ctx.accounts.fight_token_mint.key();
    state.owner = ctx.accounts.payer.key();
    state.vault_token_account = ctx.accounts.vault_token_account.key(); // Store canonical vault [L-3]
    state.total_staked = 0;
    state.paused = false;
    state.bump = ctx.bumps.state;

    // Emit initialization event for indexers [I-5]
    let clock = Clock::get()?;
    emit!(Initialized {
        owner: state.owner,
        fight_token_mint: state.fight_token_mint,
        vault_authority: ctx.accounts.vault_authority.key(),
        vault_token_account: state.vault_token_account,
        timestamp: clock.unix_timestamp,
        slot: clock.slot,
    });

    msg!("Staking program initialized");
    msg!("FIGHT Token Mint: {}", state.fight_token_mint);
    msg!("Owner: {}", state.owner);

    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = State::LEN,
        seeds = [seeds::STATE],
        bump
    )]
    pub state: Account<'info, State>,
    
    pub fight_token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = payer,
        associated_token::mint = fight_token_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Vault authority PDA
    #[account(
        seeds = [seeds::VAULT, fight_token_mint.key().as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
