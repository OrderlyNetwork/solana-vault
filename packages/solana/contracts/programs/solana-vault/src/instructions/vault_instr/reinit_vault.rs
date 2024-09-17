use crate::errors::OAppError;
use crate::instructions::{OAPP_SEED, VAULT_AUTHORITY_SEED};
use crate::state::{OAppConfig, VaultAuthority};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ReinitVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + VaultAuthority::INIT_SPACE,
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: Account<'info, VaultAuthority>,
    #[account(
        seeds = [OAPP_SEED],
        bump,
        constraint = oapp_config.admin == payer.key() @ OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    pub system_program: Program<'info, System>,
}

impl ReinitVault<'_> {
    pub fn apply(
        ctx: &mut Context<ReinitVault>,
        reset_oapp_params: &ReinitVaultParams,
    ) -> Result<()> {
        let vault_authority = &mut ctx.accounts.vault_authority;
        vault_authority.owner = reset_oapp_params.owner;
        vault_authority.dst_eid = reset_oapp_params.dst_eid;
        vault_authority.deposit_nonce = reset_oapp_params.deposit_nonce;
        vault_authority.order_delivery = reset_oapp_params.order_delivery;
        vault_authority.inbound_nonce = reset_oapp_params.inbound_nonce;
        vault_authority.bump = ctx.bumps.vault_authority;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ReinitVaultParams {
    pub owner: Pubkey,
    pub dst_eid: u32,
    pub deposit_nonce: u64,
    pub order_delivery: bool,
    pub inbound_nonce: u64,
}
