use crate::instructions::{ENFORCED_OPTIONS_SEED, OAPP_SEED, PEER_SEED};
use crate::state::{EnforcedOptions, OAppConfig, Peer};
use anchor_lang::prelude::*;
use oapp::endpoint::instructions::QuoteParams as EndpointQuoteParams;

#[derive(Accounts)]
#[instruction(params: OAppQuoteParams)]
pub struct OAppQuote<'info> {
    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    #[account(
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
}

impl OAppQuote<'_> {
    pub fn apply(ctx: &Context<OAppQuote>, params: &OAppQuoteParams) -> Result<MessagingFee> {
        // calling endpoint cpi
        let messaging_fee = oapp::endpoint_cpi::quote(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.remaining_accounts,
            EndpointQuoteParams {
                sender: ctx.accounts.oapp_config.key(),
                dst_eid: params.dst_eid,
                receiver: ctx.accounts.peer.address,
                message: params.message.clone().unwrap_or_default(),
                pay_in_lz_token: params.pay_in_lz_token,
                options: ctx.accounts.enforced_options.get_enforced_options(&None),
            },
        )?;

        return Ok(MessagingFee {
            native_fee: messaging_fee.native_fee,
            lz_token_fee: messaging_fee.lz_token_fee,
        });
    }
}

// Redefined MessagingFee here as a workaround to be able to use view() in tests
// https://github.com/coral-xyz/anchor/issues/3220
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct MessagingFee {
    pub native_fee: u64,
    pub lz_token_fee: u64,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct OAppQuoteParams {
    pub dst_eid: u32,
    pub to: [u8; 32],
    pub options: Vec<u8>,
    pub message: Option<Vec<u8>>,
    pub pay_in_lz_token: bool,
}
