use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultOwner {
    pub owner: Pubkey,
    pub bump: u8,
}
