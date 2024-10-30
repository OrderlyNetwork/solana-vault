use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::instructions::{OAPP_SEED, VAULT_AUTHORITY_SEED};
use crate::state::{OAppConfig, VaultAuthority};

#[derive(Accounts)]
#[instruction()]
pub struct SetVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + VaultAuthority::INIT_SPACE,
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: Account<'info, VaultAuthority>,

    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @ VaultError::InvalidVaultOwner,
    )]
    pub oapp_config: Account<'info, OAppConfig>,

    pub system_program: Program<'info, System>,
}

impl SetVault<'_> {
    pub fn apply(ctx: Context<SetVault>, params: &SetVaultParams) -> Result<()> {
        ctx.accounts.vault_authority.bump = ctx.bumps.vault_authority;
        ctx.accounts.vault_authority.owner = params.owner;
        ctx.accounts.vault_authority.deposit_nonce = params.deposit_nonce;
        ctx.accounts.vault_authority.order_delivery = params.order_delivery;
        ctx.accounts.vault_authority.inbound_nonce = params.inbound_nonce;
        ctx.accounts.vault_authority.dst_eid = params.dst_eid;
        ctx.accounts.vault_authority.sol_chain_id = params.sol_chain_id;
        msg!("Set Vault Authority");
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetVaultParams {
    pub owner: Pubkey,
    pub deposit_nonce: u64,
    pub order_delivery: bool,
    pub inbound_nonce: u64,
    pub dst_eid: u32,
    pub sol_chain_id: u128,
}
