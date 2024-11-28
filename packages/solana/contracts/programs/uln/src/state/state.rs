use crate::*;

#[account]
#[derive(InitSpace)]
pub struct UlnSettings {
    // immutable
    pub eid: u32,
    pub endpoint: Pubkey, // the PDA signer of the endpoint program
    pub endpoint_program: Pubkey,
    pub bump: u8,
    // mutable
    pub admin: Pubkey
}