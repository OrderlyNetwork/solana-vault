pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use errors::*;
use instructions::*;

use oapp::endpoint::MessagingReceipt;

declare_id!("ErBmAD61mGFKvrFNaTJuxoPwqrS8GgtwtqJTJVjFWx9Q");

#[program]
pub mod solana_vault {
    use super::*;

    pub fn set_vault(ctx: Context<SetVault>, params: SetVaultParams) -> Result<()> {
        SetVault::apply(ctx, &params)
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

    pub fn set_account_list(
        mut ctx: Context<SetAccountList>,
        params: SetAccountListParams,
    ) -> Result<()> {
        SetAccountList::apply(&mut ctx, &params)
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

    pub fn oapp_quote(ctx: Context<OAppQuote>, params: DepositParams) -> Result<MessagingFee> {
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
