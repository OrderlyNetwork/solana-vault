use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AllowedBroker {
    pub broker_hash: [u8; 32],
    pub allowed: bool,
    pub bump: u8,
}
