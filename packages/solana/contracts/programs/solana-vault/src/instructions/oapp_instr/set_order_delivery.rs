use crate::errors::VaultError;
use crate::instructions::VAULT_AUTHORITY_SEED;
use crate::state::VaultAuthority;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetOrderDelivery<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
        constraint = vault_authority.owner == payer.key() @ VaultError::InvalidVaultOwner
    )]
    pub vault_authority: Account<'info, VaultAuthority>,
}

impl SetOrderDelivery<'_> {
    pub fn apply(
        ctx: &mut Context<SetOrderDelivery>,
        params: &SetOrderDeliveryParams,
    ) -> Result<()> {
        ctx.accounts.vault_authority.order_delivery = params.order_delivery;
        ctx.accounts.vault_authority.inbound_nonce = params.nonce;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetOrderDeliveryParams {
    pub order_delivery: bool,
    pub nonce: u64,
}
