use crate::*;

#[account]
#[derive(InitSpace)]
pub struct EndpointSettings {
    // immutable
    pub eid: u32,
    pub bump: u8,
    // configurable
    pub admin: Pubkey,
    pub lz_token_mint: Option<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct OAppRegistry {
    pub delegate: Pubkey,
    pub bump: u8,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, InitSpace)]
pub struct SendContext {
    pub dst_eid: u32,
    pub sender: Pubkey,
}

