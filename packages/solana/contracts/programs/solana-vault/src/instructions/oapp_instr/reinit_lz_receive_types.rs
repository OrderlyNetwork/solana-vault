use crate::errors::OAppError;
use crate::instructions::{LZ_RECEIVE_TYPES_SEED, OAPP_SEED};
use crate::state::{OAppConfig, OAppLzReceiveTypesAccounts};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ReinitLzReceiveTypes<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @ OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,

    #[account(
        init,
        payer = admin,
        space = 8 + OAppLzReceiveTypesAccounts::INIT_SPACE,
        seeds = [LZ_RECEIVE_TYPES_SEED, &oapp_config.key().as_ref()],
        bump
    )]
    pub lz_receive_types: Account<'info, OAppLzReceiveTypesAccounts>,

    pub system_program: Program<'info, System>,
}

impl ReinitLzReceiveTypes<'_> {
    pub fn apply(
        ctx: &mut Context<ReinitLzReceiveTypes>,
        reinit_lz_receive_types_params: &ReinitLzReceiveTypesParams,
    ) -> Result<()> {
        let lz_receive_types_account = &mut ctx.accounts.lz_receive_types;
        lz_receive_types_account.oapp_config = reinit_lz_receive_types_params.oapp_config;
        lz_receive_types_account.allowed_usdc = reinit_lz_receive_types_params.allowed_usdc;

        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ReinitLzReceiveTypesParams {
    pub oapp_config: Pubkey,
    pub allowed_usdc: Pubkey,
    // can add more allowed tokens here in the future
}
