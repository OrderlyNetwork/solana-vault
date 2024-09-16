use crate::errors::{OAppError, VaultError};
use crate::instructions::{OAPP_SEED, OWNER_SEED};
use crate::state::{OAppConfig, VaultOwner};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetOrderDelivery<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [OAPP_SEED],
        bump,
        constraint = oapp_config.admin == payer.key() @ OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    #[account(
        seeds = [OWNER_SEED],
        bump,
        constraint = vault_owner.owner == payer.key() @ VaultError::InvalidVaultOwner
    )]
    pub vault_owner: Account<'info, VaultOwner>,
}

impl SetOrderDelivery<'_> {
    pub fn apply(
        ctx: &mut Context<SetOrderDelivery>,
        params: &SetOrderDeliveryParams,
    ) -> Result<()> {
        ctx.accounts.oapp_config.order_delivery = params.order_delivery;
        ctx.accounts.oapp_config.inbound_nonce = params.nonce;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetOrderDeliveryParams {
    pub order_delivery: bool,
    pub nonce: u64,
}
