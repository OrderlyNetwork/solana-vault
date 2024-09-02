use anchor_lang::prelude::error_code;

// Vault errors
#[error_code]
pub enum VaultError {
    #[msg("Deposited funds are insufficient for withdrawal")]
    InsufficientFunds,
    #[msg("User info pda belongs to another user")]
    UserInfoBelongsToAnotherUser,
}

// OApp errors
#[error_code]
pub enum OAppError {
    Unauthorized,
    InvalidSender,
    InvalidOptions,
    InvalidEndpointProgram,
    RateLimitExceeded,
    WithdrawFailed,
}
