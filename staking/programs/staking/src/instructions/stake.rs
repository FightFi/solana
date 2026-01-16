use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::{State, UserStake};
use crate::errors::StakingError;
use crate::events::Staked;
use crate::constants::seeds;

/// Stake FIGHT tokens
/// Transfers tokens from user to the staking vault and updates user balance
pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    // Check if contract is paused
    require!(!state.paused, StakingError::ContractPaused);
    require!(amount > 0, StakingError::ZeroAmount);

    // Get user balance before
    let user_stake = &mut ctx.accounts.user_stake;
    
    // Initialize user stake account if it's new
    if user_stake.user == Pubkey::default() {
        user_stake.user = ctx.accounts.user.key();
        user_stake.balance = 0;
        user_stake.bump = ctx.bumps.user_stake;
    }
    
    let user_balance_before = user_stake.balance;

    // Update balances
    user_stake.balance = user_stake.balance.checked_add(amount)
        .ok_or(StakingError::Overflow)?;
    state.total_staked = state.total_staked.checked_add(amount)
        .ok_or(StakingError::Overflow)?;

    // Transfer tokens from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Emit event
    emit!(Staked {
        user: ctx.accounts.user.key(),
        amount,
        user_balance_before,
        user_balance_after: user_stake.balance,
        total_staked_after: state.total_staked,
        timestamp: Clock::get()?.unix_timestamp,
        slot: Clock::get()?.slot,
    });

    msg!("Staked {} tokens", amount);
    msg!("User balance: {}", user_stake.balance);
    msg!("Total staked: {}", state.total_staked);

    Ok(())
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        mut,
        seeds = [seeds::STATE],
        bump = state.bump
    )]
    pub state: Account<'info, State>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = UserStake::LEN,
        seeds = [seeds::USER_STAKE, user.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.mint == state.fight_token_mint @ StakingError::InvalidTokenMint,
        constraint = user_token_account.owner == user.key() @ StakingError::InvalidTokenAccount
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
