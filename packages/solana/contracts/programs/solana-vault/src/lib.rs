mod errors;
mod events;
mod instructions;
mod state;

use anchor_lang::prelude::*;
use errors::*;
use instructions::*;

use oapp::endpoint::{MessagingFee, MessagingReceipt};

declare_id!("EFLrsQmcfYTSvVrUiP4qruDhbYBtjbQNAhC6tkLJbBtQ");

#[program]
pub mod solana_vault {
    use super::*;

    pub fn init_vault(mut ctx: Context<InitVault>, params: InitVaultParams) -> Result<()> {
        InitVault::apply(&mut ctx, &params)
    }

    pub fn deposit<'info>(
        mut ctx: Context<'_, '_, '_, 'info, Deposit<'info>>,
        deposit_params: DepositParams,
        oapp_params: OAppSendParams,
    ) -> Result<MessagingReceipt> {
        Deposit::apply(&mut ctx, &deposit_params, &oapp_params)
    }

    pub fn init_oapp(mut ctx: Context<InitOApp>, params: InitOAppParams) -> Result<()> {
        InitOApp::apply(&mut ctx, &params)
    }

    pub fn reset_oapp(mut ctx: Context<ResetOApp>) -> Result<()> {
        ResetOApp::apply(&mut ctx)
    }

    pub fn reinit_oapp(mut ctx: Context<ReinitOApp>, params: ReinitOAppParams) -> Result<()> {
        ReinitOApp::apply(&mut ctx, &params)
    }

    pub fn reset_vault(mut ctx: Context<ResetVault>) -> Result<()> {
        ResetVault::apply(&mut ctx)
    }

    pub fn reinit_vault(mut ctx: Context<ReinitVault>, params: ReinitVaultParams) -> Result<()> {
        ReinitVault::apply(&mut ctx, &params)
    }

    pub fn set_broker(mut ctx: Context<SetBroker>, params: SetBrokerParams) -> Result<()> {
        SetBroker::apply(&mut ctx, &params)
    }

    pub fn set_token(mut ctx: Context<SetToken>, params: SetTokenParams) -> Result<()> {
        SetToken::apply(&mut ctx, &params)
    }

    pub fn set_order_delivery(
        mut ctx: Context<SetOrderDelivery>,
        params: SetOrderDeliveryParams,
    ) -> Result<()> {
        SetOrderDelivery::apply(&mut ctx, &params)
    }

    pub fn oapp_quote(ctx: Context<OAppQuote>, params: OAppQuoteParams) -> Result<MessagingFee> {
        OAppQuote::apply(&ctx, &params)
    }

    pub fn lz_receive(mut ctx: Context<OAppLzReceive>, params: OAppLzReceiveParams) -> Result<()> {
        OAppLzReceive::apply(&mut ctx, &params)
    }

    pub fn lz_receive_types(
        ctx: Context<OAppLzReceiveTypes>,
        params: OAppLzReceiveParams,
    ) -> Result<Vec<oapp::endpoint_cpi::LzAccount>> {
        OAppLzReceiveTypes::apply(&ctx, &params)
    }

    pub fn set_rate_limit(
        mut ctx: Context<SetRateLimit>,
        params: SetRateLimitParams,
    ) -> Result<()> {
        SetRateLimit::apply(&mut ctx, &params)
    }

    // Set the LayerZero endpoint delegate for OApp admin functions
    pub fn set_delegate(mut ctx: Context<SetDelegate>, params: SetDelegateParams) -> Result<()> {
        SetDelegate::apply(&mut ctx, &params)
    }

    // ============================== Admin ==============================
    pub fn transfer_admin(
        mut ctx: Context<TransferAdmin>,
        params: TransferAdminParams,
    ) -> Result<()> {
        TransferAdmin::apply(&mut ctx, &params)
    }

    pub fn set_peer(mut ctx: Context<SetPeer>, params: SetPeerParams) -> Result<()> {
        SetPeer::apply(&mut ctx, &params)
    }

    pub fn set_enforced_options(
        mut ctx: Context<SetEnforcedOptions>,
        params: SetEnforcedOptionsParams,
    ) -> Result<()> {
        SetEnforcedOptions::apply(&mut ctx, &params)
    }
}
