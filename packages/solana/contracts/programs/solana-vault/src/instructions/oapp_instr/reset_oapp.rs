use crate::errors::OAppError;
use crate::instructions::OAPP_SEED;
use crate::state::OAppConfig;
use anchor_lang::prelude::*;
use anchor_lang::system_program;

#[derive(Accounts)]
pub struct ResetOApp<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @ OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,
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
