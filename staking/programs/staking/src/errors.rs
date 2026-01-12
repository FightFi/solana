use anchor_lang::error_code;

/// Error codes for the staking program
#[error_code]
pub enum StakingError {
    #[msg("Contract is paused")]
    ContractPaused,
    #[msg("Contract is not paused")]
    NotPaused,
    #[msg("Contract is already paused")]
    AlreadyPaused,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Unauthorized: only owner can perform this action")]
    Unauthorized,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Invalid user")]
    InvalidUser,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
}
