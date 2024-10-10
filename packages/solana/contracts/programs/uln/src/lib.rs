mod instructions;
mod state;

use anchor_lang::prelude::*;
use instructions::*;
use state::*;

pub const PACKET_VERSION: u8 = 1;
pub const ULN_SEED: &[u8] = b"MessageLib";
pub const SEND_CONFIG_SEED: &[u8] = b"SendConfig";
pub const RECEIVE_CONFIG_SEED: &[u8] = b"ReceiveConfig";
pub const CONFIRMATIONS_SEED: &[u8] = b"Confirmations";

declare_id!("H5Uke9DE4jFiJi73Ade5g3yPwMhfVVbzPWqomoUfqQhb");

#[program]
pub mod uln {
    use super::*;

    pub fn init_uln(mut ctx: Context<InitUln>, params: InitUlnParams) -> Result<()> {
        InitUln::apply(&mut ctx, &params)
    }

    // TODO ===========================================================>
    // 1. implement initialize ULN - DONE
    // 2. replace messageLibPda to use the programId of this mock ULN program - DONE
    // 3. run initUln to initialize messageLib - DONE
    // 3. run commit_verification to call verify in Endpoint <======================================
    pub fn commit_verification(mut ctx: Context<CommitVerification>, params: CommitVerificationParams) -> Result<()> {
        CommitVerification::apply(&mut ctx, &params)
    }
}