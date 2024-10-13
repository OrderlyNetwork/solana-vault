use crate::*;
use messagelib_helper::{
    endpoint::instructions::hash_payload, endpoint_verify, messagelib_interface::Packet, packet_v1_codec
};

#[derive(Accounts)]
#[instruction(params: CommitVerificationParams)]
pub struct CommitVerification<'info> {
    #[account(seeds = [ULN_SEED], bump = uln.bump)]
    pub uln: Account<'info, UlnSettings>,
}

impl CommitVerification<'_> {
    pub fn apply(
        ctx: &mut Context<CommitVerification>,
        params: &CommitVerificationParams
    ) -> Result<()> {
        let packet = &Packet {
            nonce: params.nonce,
            src_eid: params.src_eid,
            sender: params.sender,
            dst_eid: params.dst_eid,
            receiver: params.receiver,
            guid: params.guid,
            message: params.message.clone(),
        };
        let packet_header = packet_v1_codec::encode_packet_header(packet);
        let payload_hash = hash_payload(&params.guid, &params.message);

        endpoint_verify::verify(
            ctx.accounts.uln.endpoint_program,
            ctx.accounts.uln.key(),
            &packet_header,
            payload_hash,
            &[ULN_SEED, &[ctx.accounts.uln.bump]],
            &ctx.remaining_accounts,
        )
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct CommitVerificationParams {
    pub nonce: u64,
    pub src_eid: u32,
    pub sender: Pubkey,
    pub dst_eid: u32,
    pub receiver: [u8; 32],
    pub guid: [u8; 32],
    pub message: Vec<u8>,
}
