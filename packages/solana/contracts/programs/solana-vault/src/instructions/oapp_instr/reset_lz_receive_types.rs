use crate::errors::OAppError;
use crate::instructions::{LZ_RECEIVE_TYPES_SEED, OAPP_SEED};
use crate::state::{OAppConfig, OAppLzReceiveTypesAccounts};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

#[derive(Accounts)]
pub struct ResetLzReceiveTypes<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @ OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,

    #[account(
        mut,
        // close = true,
        seeds = [LZ_RECEIVE_TYPES_SEED, &oapp_config.key().as_ref()],
        bump
    )]
    pub lz_receive_types: Account<'info, OAppLzReceiveTypesAccounts>,
}

impl ResetLzReceiveTypes<'_> {
    pub fn apply(ctx: &mut Context<ResetLzReceiveTypes>) -> Result<()> {
        let lz_receive_types_account = &mut ctx.accounts.lz_receive_types.to_account_info();
        lz_receive_types_account.assign(&system_program::ID);
        lz_receive_types_account.realloc(0, false)?;
        msg!("Reset OAppLzReceiveTypesAccounts");
        Ok(())
    }
}
