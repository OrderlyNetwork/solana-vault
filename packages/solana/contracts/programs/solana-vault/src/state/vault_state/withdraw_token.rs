use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WithdrawToken {
    pub mint_account: Pubkey,
    pub token_hash: [u8; 32],
    pub token_decimals: u8,
    pub token_index: u8,
    pub allowed: bool,
    pub bump: u8,
}
