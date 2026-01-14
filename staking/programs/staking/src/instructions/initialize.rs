use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use anchor_spl::token::Token;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::TokenAccount;

use crate::state::State;
use crate::constants::seeds;

/// Initialize the staking program
/// Sets up the state account with the FIGHT token mint and owner
/// Creates the vault token account for storing staked tokens
pub fn initialize(ctx: Context<Initialize>, owner: Pubkey) -> Result<()> {
    let state = &mut ctx.accounts.state;
    state.fight_token_mint = ctx.accounts.fight_token_mint.key();
    state.owner = owner;
    state.total_staked = 0;
    state.paused = false;
    state.bump = ctx.bumps.state;
    
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
