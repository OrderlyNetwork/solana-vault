use anchor_lang::prelude::*;

#[account]
pub struct UserInfo {
    pub user: Pubkey,
    pub amount: u64
}

impl UserInfo {
    pub const LEN: usize = 32 + 8;

    pub fn init(user: Pubkey) -> Self {
        Self {
            user,
            amount: 0,
        }
    }
}
