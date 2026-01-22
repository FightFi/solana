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

// Program ID is selected at compile time based on target network
// Build with: anchor build -- --features testnet
// Build with: anchor build -- --features mainnet
#[cfg(feature = "mainnet")]
declare_id!("4D9WKeKXKCEjzZfuLgU3H7P9J1cJ1HZ2fPURAX8ceqKc");

#[cfg(feature = "testnet")]
declare_id!("5HWYY9fuyvCrvV66GCg5hPbf7XARCcybuQrdJGGEbEVH");

#[cfg(not(any(feature = "mainnet", feature = "testnet")))]
declare_id!("9aZRVnxzy8kRiq8mHcfFBj1BX2hY7ixUJH24Q4aYjycd");

#[program]
pub mod staking {
    use super::*;

    /// Initialize the staking program
    /// Security: Owner is set to payer to prevent front-running [L-2] [I-3]
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
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
#[allow(ambiguous_glob_reexports)]
pub use instructions::*;
