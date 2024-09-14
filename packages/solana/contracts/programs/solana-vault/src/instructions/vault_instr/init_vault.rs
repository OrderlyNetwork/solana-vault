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
    pub fn apply(ctx: &mut Context<InitVault>) -> Result<()> {
        ctx.accounts.vault_authority.bump = ctx.bumps.vault_authority;
        ctx.accounts.vault_authority.nonce = 0;
        Ok(())
    }
}
