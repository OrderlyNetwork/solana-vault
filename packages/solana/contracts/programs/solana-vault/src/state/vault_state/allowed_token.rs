use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AllowedToken {
    pub mint_account: Pubkey,
    pub token_hash: [u8; 32],
    pub token_decimals: u8,
    pub allowed: bool,
    pub bump: u8,
}
