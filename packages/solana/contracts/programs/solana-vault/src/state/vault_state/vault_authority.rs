use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultAuthority {
    /// Bump seed for the vault authority PDA
    pub bump: u8,
    pub owner: Pubkey,
    pub deposit_nonce: u64,
    pub order_delivery: bool,
    pub inbound_nonce: u64,
    pub dst_eid: u32,
    pub sol_chain_id: u128,
}
