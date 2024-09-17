use anchor_lang::prelude::*;

use crate::instructions::VAULT_AUTHORITY_SEED;
use crate::state::VaultAuthority;

#[derive(Accounts)]
#[instruction()]
pub struct InitVault<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + VaultAuthority::INIT_SPACE,
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: Account<'info, VaultAuthority>,

    pub system_program: Program<'info, System>,
}

impl InitVault<'_> {
    pub fn apply(ctx: &mut Context<InitVault>, params: &InitVaultParams) -> Result<()> {
        ctx.accounts.vault_authority.bump = ctx.bumps.vault_authority;
        ctx.accounts.vault_authority.owner = params.owner;
        ctx.accounts.vault_authority.deposit_nonce = 0;
        ctx.accounts.vault_authority.order_delivery = params.order_delivery;
        ctx.accounts.vault_authority.inbound_nonce = 0;
        ctx.accounts.vault_authority.dst_eid = params.dst_eid;
        msg!("Vault authority initialized");
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitVaultParams {
    pub owner: Pubkey,
    pub order_delivery: bool,
    pub dst_eid: u32,
}
