use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultAuthority {
    /// Bump seed for the vault authority PDA
    pub bump: u8,
    /// Nonce to use in src_chain_deposit_nonce
    pub nonce: u64,
}
