use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WithdrawBroker {
    pub broker_hash: [u8; 32],
    pub broker_index: u16,
    pub allowed: bool,
    pub bump: u8,
}
