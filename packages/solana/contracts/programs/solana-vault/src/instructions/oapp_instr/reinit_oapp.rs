use crate::errors::VaultError;
use crate::instructions::{OAPP_SEED, VAULT_AUTHORITY_SEED};
use crate::state::{OAppConfig, VaultAuthority};
use anchor_lang::prelude::*;
use oapp::endpoint::ID as ENDPOINT_ID;

#[derive(Accounts)]
pub struct ReinitOApp<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + OAppConfig::INIT_SPACE,
        seeds = [OAPP_SEED],
        bump
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump=vault_authority.bump,
        has_one = owner @ VaultError::InvalidVaultOwner
    )]
    pub vault_authority: Account<'info, VaultAuthority>,
    pub system_program: Program<'info, System>,
}

impl ReinitOApp<'_> {
    pub fn apply(
        ctx: &mut Context<ReinitOApp>,
        reset_oapp_params: &ReinitOAppParams,
    ) -> Result<()> {
        let oapp_config = &mut ctx.accounts.oapp_config;
        oapp_config.admin = reset_oapp_params.admin;
        oapp_config.endpoint_program =
            if let Some(endpoint_program) = reset_oapp_params.endpoint_program {
                endpoint_program
            } else {
                ENDPOINT_ID
            };
        oapp_config.usdc_hash = reset_oapp_params.usdc_hash;
        oapp_config.usdc_mint = reset_oapp_params.usdc_mint;
        oapp_config.bump = ctx.bumps.oapp_config;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ReinitOAppParams {
    pub admin: Pubkey,
    pub endpoint_program: Option<Pubkey>,
    pub usdc_hash: [u8; 32],
    pub usdc_mint: Pubkey,
}
