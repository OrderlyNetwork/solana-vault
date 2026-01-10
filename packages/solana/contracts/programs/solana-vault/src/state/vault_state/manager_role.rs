use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ManagerRole {
    pub role_hash: [u8; 32],
    pub allowed: bool,
    pub bump: u8,
}
