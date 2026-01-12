use anchor_lang::prelude::*;

// Module declarations
pub mod constants;
pub mod state;
pub mod errors;
pub mod events;
pub mod instructions;

// Re-exports for convenience
pub use state::*;
pub use errors::*;
pub use events::*;

declare_id!("9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd");

#[program]
pub mod staking {
    use super::*;

    /// Initialize the staking program
    pub fn initialize(ctx: Context<Initialize>, owner: Pubkey) -> Result<()> {
        instructions::initialize(ctx, owner)
    }

    /// Stake FIGHT tokens
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        instructions::stake(ctx, amount)
    }

    /// Unstake FIGHT tokens
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        instructions::unstake(ctx, amount)
    }

    /// Pause the staking contract (only owner)
    pub fn pause(ctx: Context<Admin>) -> Result<()> {
        instructions::pause(ctx)
    }

    /// Unpause the staking contract (only owner)
    pub fn unpause(ctx: Context<Admin>) -> Result<()> {
        instructions::unpause(ctx)
    }
}

// Re-export instruction contexts
pub use instructions::*;
