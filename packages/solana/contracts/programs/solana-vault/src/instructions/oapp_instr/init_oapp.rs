use crate::instructions::{ACCOUNT_LIST_SEED, LZ_RECEIVE_TYPES_SEED, OAPP_SEED};
use crate::state::{AccountList, OAppConfig, OAppLzReceiveTypesAccounts};
use anchor_lang::prelude::*;

// Initialize the oapp_config and vault_owner pda
#[derive(Accounts)]
#[instruction(params: InitOAppParams)]
pub struct InitOApp<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + OAppConfig::INIT_SPACE,
        seeds = [OAPP_SEED],
        bump
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    #[account(
        init,
        payer = payer,
        space = 8 + OAppLzReceiveTypesAccounts::INIT_SPACE,
        seeds = [LZ_RECEIVE_TYPES_SEED, &oapp_config.key().as_ref()],
        bump
    )]
    pub lz_receive_types: Account<'info, OAppLzReceiveTypesAccounts>,

    #[account(
        init,
        payer = payer,
        space = 8 + AccountList::INIT_SPACE,
        seeds = [ACCOUNT_LIST_SEED, &oapp_config.key().as_ref()],
        bump
    )]
    pub account_list: Account<'info, AccountList>,

    pub system_program: Program<'info, System>,
}

impl InitOApp<'_> {
    pub fn apply(ctx: &mut Context<InitOApp>, params: &InitOAppParams) -> Result<()> {
        ctx.accounts.lz_receive_types.oapp_config = ctx.accounts.oapp_config.key();
        ctx.accounts.lz_receive_types.account_list = params.account_list;
        ctx.accounts.account_list.bump = ctx.bumps.account_list;

        ctx.accounts.oapp_config.bump = ctx.bumps.oapp_config;
        let oapp_signer = ctx.accounts.oapp_config.key();
        ctx.accounts.oapp_config.init(
            params.endpoint_program,
            params.admin,
            ctx.remaining_accounts,
            oapp_signer,
        )
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitOAppParams {
    pub admin: Pubkey,
    pub account_list: Pubkey,
    pub endpoint_program: Option<Pubkey>,
}
