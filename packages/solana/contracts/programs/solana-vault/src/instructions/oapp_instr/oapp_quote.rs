use crate::instructions::{
    DepositParams, LzMessage, MsgType, VaultDepositParams, ENFORCED_OPTIONS_SEED, OAPP_SEED,
    PEER_SEED, VAULT_AUTHORITY_SEED,
};
use crate::state::{EnforcedOptions, OAppConfig, Peer, VaultAuthority};
use anchor_lang::prelude::*;
use oapp::endpoint::instructions::QuoteParams as EndpointQuoteParams;

#[derive(Accounts)]
#[instruction(params: DepositParams)]
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
            &vault_authority.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Account<'info, Peer>,
    #[account(
        seeds = [
            ENFORCED_OPTIONS_SEED,
            &oapp_config.key().to_bytes(),
            &vault_authority.dst_eid.to_be_bytes()
        ],
        bump = enforced_options.bump
    )]
    pub enforced_options: Account<'info, EnforcedOptions>,

    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
}

impl OAppQuote<'_> {
    pub fn apply(ctx: &Context<OAppQuote>, params: &DepositParams) -> Result<MessagingFee> {
        let vault_deposit_params = VaultDepositParams {
            account_id: params.account_id,
            broker_hash: params.broker_hash,
            user_address: params.user_address, //
            token_hash: params.token_hash,
            src_chain_id: ctx.accounts.vault_authority.sol_chain_id,
            token_amount: params.token_amount as u128,
            src_chain_deposit_nonce: ctx.accounts.vault_authority.deposit_nonce,
        };

        let deposit_msg = VaultDepositParams::encode(&vault_deposit_params);
        let lz_message = LzMessage::encode(&LzMessage {
            msg_type: MsgType::Deposit as u8,
            payload: deposit_msg,
        });

        let options = EnforcedOptions::get_enforced_options(&ctx.accounts.enforced_options, &None);

        let endpoint_quote_params = EndpointQuoteParams {
            sender: ctx.accounts.oapp_config.key(),
            dst_eid: ctx.accounts.vault_authority.dst_eid,
            receiver: ctx.accounts.peer.address,
            message: lz_message,
            pay_in_lz_token: false,
            options: options,
        };
        // calling endpoint cpi
        let messaging_fee = oapp::endpoint_cpi::quote(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.remaining_accounts,
            endpoint_quote_params,
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
