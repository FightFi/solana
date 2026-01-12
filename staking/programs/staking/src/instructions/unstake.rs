use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::{State, UserStake};
use crate::errors::StakingError;
use crate::events::Unstaked;
use crate::constants::seeds;

/// Unstake FIGHT tokens
/// Transfers tokens from vault back to user and updates balances
pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    require!(amount > 0, StakingError::ZeroAmount);

    let user_stake = &mut ctx.accounts.user_stake;
    require!(user_stake.balance >= amount, StakingError::InsufficientBalance);

    // Get user balance before
    let user_balance_before = user_stake.balance;

    // Update balances
    user_stake.balance = user_stake.balance.checked_sub(amount)
        .ok_or(StakingError::Underflow)?;
    state.total_staked = state.total_staked.checked_sub(amount)
        .ok_or(StakingError::Underflow)?;

    // Transfer tokens from vault to user
    let vault_seeds = &[
        seeds::VAULT,
        state.fight_token_mint.as_ref(),
        &[ctx.bumps.vault_authority],
    ];
    let signer = &[&vault_seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;

    // Emit event
    emit!(Unstaked {
        user: ctx.accounts.user.key(),
        amount,
        user_balance_before,
        user_balance_after: user_stake.balance,
        total_staked_after: state.total_staked,
        timestamp: Clock::get()?.unix_timestamp,
        slot: Clock::get()?.slot,
    });

    msg!("Unstaked {} tokens", amount);
    msg!("User balance: {}", user_stake.balance);
    msg!("Total staked: {}", state.total_staked);

    Ok(())
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(
        seeds = [seeds::STATE],
        bump = state.bump
    )]
    pub state: Account<'info, State>,
    
    #[account(
        mut,
        seeds = [seeds::USER_STAKE, user.key().as_ref()],
        bump = user_stake.bump,
        constraint = user_stake.user == user.key() @ StakingError::InvalidUser
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
    
    #[account(
        mut,
        seeds = [seeds::VAULT, state.fight_token_mint.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Vault authority PDA
    #[account(
        seeds = [seeds::VAULT, state.fight_token_mint.as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}
