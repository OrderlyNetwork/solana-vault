use crate::errors::VaultError;
use crate::instructions::{OAPP_SEED, OWNER_SEED};
use crate::state::{OAppConfig, VaultOwner};
use anchor_lang::prelude::*;
use anchor_lang::system_program;
/// This instruction should always be in the same transaction as InitializeMint.
/// Otherwise, it is possible for your settings to be front-run by another transaction.
/// If such a case did happen, you should initialize another mint for this oapp.
#[derive(Accounts)]
pub struct ResetOApp<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [OAPP_SEED],
        bump
    )]
    pub oapp_config: Account<'info, OAppConfig>,

    #[account(
        mut,
        seeds = [OWNER_SEED],
        bump,
        constraint = vault_owner.owner == payer.key() @ VaultError::InvalidVaultOwner
    )]
    pub vault_owner: Account<'info, VaultOwner>,
}

impl ResetOApp<'_> {
    pub fn apply(ctx: &mut Context<ResetOApp>) -> Result<()> {
        let oapp_config_account_info = &mut ctx.accounts.oapp_config.to_account_info();
        oapp_config_account_info.assign(&system_program::ID);
        oapp_config_account_info.realloc(0, false)?;
        msg!("Reset OApp");
        Ok(())
    }
}
