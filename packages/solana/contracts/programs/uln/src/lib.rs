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

    pub fn quote(_ctx: Context<Interface>, _params: QuoteParams) -> Result<MessagingFee> {
        let messaging_fee = MessagingFee {
            native_fee: 1000,
            lz_token_fee: 900
        };

        Ok(messaging_fee)
    }
}

#[derive(Accounts)]
pub struct Interface<'info> {
    pub endpoint: Signer<'info>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, Default)]
pub struct MessagingFee {
    pub native_fee: u64,
    pub lz_token_fee: u64,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct QuoteParams {
    pub packet: Packet,
    pub options: Vec<u8>,
    pub pay_in_lz_token: bool,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct Packet {
    pub nonce: u64,
    pub src_eid: u32,
    pub sender: Pubkey,
    pub dst_eid: u32,
    pub receiver: [u8; 32],
    pub guid: [u8; 32],
    pub message: Vec<u8>,
}