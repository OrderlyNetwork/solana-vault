use crate::*;
use oapp::endpoint::{instructions::SendParams as EndpointSendParams, MessagingReceipt};

#[event_cpi]
#[derive(Accounts)]
#[instruction(params: OAppSendParams)]
pub struct OAppSend<'info> {
    #[account(
        mut,
        seeds = [
            PEER_SEED,
            &oapp_config.key().to_bytes(),
            &params.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Account<'info, Peer>,
    #[account(
        seeds = [
            ENFORCED_OPTIONS_SEED,
            &oapp_config.key().to_bytes(),
            &params.dst_eid.to_be_bytes()
        ],
        bump = enforced_options.bump
    )]
    pub enforced_options: Account<'info, EnforcedOptions>,
    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump
    )]
    pub oapp_config: Account<'info, OAppConfig>,
}

impl OAppSend<'_> {
    pub fn apply(ctx: &mut Context<OAppSend>, params: &OAppSendParams) -> Result<MessagingReceipt> {
        msg!("Calling OApp with params.message: {:?}", params.message);
        msg!(
            "length of remaining accounts: {:?}",
            ctx.remaining_accounts.len()
        );

        require!(
            ctx.accounts.oapp_config.key() == ctx.remaining_accounts[1].key(),
            OAppError::InvalidSender
        );
        let receipt = oapp::endpoint_cpi::send(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.accounts.oapp_config.key(),
            ctx.remaining_accounts,
            &[OAPP_SEED, &[ctx.accounts.oapp_config.bump]],
            EndpointSendParams {
                dst_eid: params.dst_eid,
                receiver: ctx.accounts.peer.address,
                message: params.message.clone().unwrap_or_default(),
                options: ctx
                    .accounts
                    .enforced_options
                    .combine_options(&params.message, &params.options)?,
                native_fee: params.native_fee,
                lz_token_fee: params.lz_token_fee,
            },
        )?;

        emit_cpi!(OAppSent {
            guid: receipt.guid,
            dst_eid: params.dst_eid,
        });

        Ok(receipt)
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct OAppSendParams {
    pub dst_eid: u32,
    pub to: [u8; 32],
    pub options: Vec<u8>,
    pub message: Option<Vec<u8>>,
    pub native_fee: u64,
    pub lz_token_fee: u64,
}
