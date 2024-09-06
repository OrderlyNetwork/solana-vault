use crate::errors::OAppError;
use crate::instructions::OAPP_SEED;
use crate::state::OAppConfig;
use anchor_lang::prelude::*;
use endpoint::instructions::SetDelegateParams as EndpointSetDelegateParams;
use oapp::endpoint;

#[derive(Accounts)]
#[instruction(params: SetDelegateParams)]
pub struct SetDelegate<'info> {
    pub admin: Signer<'info>,
    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,
}

impl SetDelegate<'_> {
    pub fn apply(ctx: &mut Context<SetDelegate>, params: &SetDelegateParams) -> Result<()> {
        let seeds: &[&[u8]] = &[OAPP_SEED, &[ctx.accounts.oapp_config.bump]];
        let _ = oapp::endpoint_cpi::set_delegate(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.accounts.oapp_config.key(),
            &ctx.remaining_accounts,
            seeds,
            EndpointSetDelegateParams {
                delegate: params.delegate,
            },
        )?;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetDelegateParams {
    pub delegate: Pubkey,
}
