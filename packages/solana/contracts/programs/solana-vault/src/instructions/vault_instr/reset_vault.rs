use crate::errors::VaultError;
use crate::instructions::VAULT_AUTHORITY_SEED;
use crate::state::VaultAuthority;
use anchor_lang::prelude::*;
use anchor_lang::system_program;

#[derive(Accounts)]
pub struct ResetVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump,
        has_one = owner @ VaultError::InvalidVaultOwner
    )]
    pub vault_authority: Account<'info, VaultAuthority>,
}

impl ResetVault<'_> {
    pub fn apply(ctx: &mut Context<ResetVault>) -> Result<()> {
        let vault_authority = &mut ctx.accounts.vault_authority.to_account_info();
        vault_authority.assign(&system_program::ID);
        vault_authority.realloc(0, false)?;
        msg!("Reset OApp");
        Ok(())
    }
}
