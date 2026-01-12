/// Basic size constants
pub const DISCRIMINATOR_SIZE: usize = 8;
pub const PUBKEY_SIZE: usize = 32;
pub const U64_SIZE: usize = 8;
pub const U8_SIZE: usize = 1;
pub const BOOL_SIZE: usize = 1;

/// Account size constants
pub const STATE_LEN: usize = DISCRIMINATOR_SIZE + // discriminator
    PUBKEY_SIZE + // fight_token_mint
    PUBKEY_SIZE + // owner
    U64_SIZE + // total_staked
    BOOL_SIZE + // paused
    U8_SIZE; // bump

pub const USER_STAKE_LEN: usize = DISCRIMINATOR_SIZE + // discriminator
    PUBKEY_SIZE + // user
    U64_SIZE + // balance
    U8_SIZE; // bump

/// FIGHT Token Mint address
/// This is the native SPL token mint for FIGHT tokens
pub const FIGHT_TOKEN_MINT: &str = "8f62NyJGo7He5uWeveTA2JJQf4xzf8aqxkmzxRQ3mxfU";

/// PDA seeds for the staking program
pub mod seeds {
    /// Seed for the state PDA
    pub const STATE: &[u8] = b"state";
    
    /// Seed for the vault PDA
    pub const VAULT: &[u8] = b"vault";
    
    /// Seed prefix for user stake PDAs
    pub const USER_STAKE: &[u8] = b"user_stake";
}



