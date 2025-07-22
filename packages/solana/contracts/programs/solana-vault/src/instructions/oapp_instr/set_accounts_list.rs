use crate::errors::OAppError;
use crate::instructions::{ACCOUNT_LIST_SEED, LZ_RECEIVE_TYPES_SEED, OAPP_SEED};
use crate::state::{AccountList, OAppConfig, OAppLzReceiveTypesAccounts};
use anchor_lang::prelude::*;

// Setialize the oapp_config and vault_owner pda
#[derive(Accounts)]
#[instruction(params: SetAccountListParams)]
pub struct SetAccountList<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [OAPP_SEED],
        has_one = admin @ OAppError::Unauthorized,
        bump = oapp_config.bump,
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    #[account(
        mut,
        seeds = [LZ_RECEIVE_TYPES_SEED, &oapp_config.key().as_ref()],
        bump
    )]
    pub lz_receive_types: Account<'info, OAppLzReceiveTypesAccounts>,

    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + AccountList::INIT_SPACE,
        seeds = [ACCOUNT_LIST_SEED, &oapp_config.key().as_ref()],
        bump
    )]
    pub accounts_list: Account<'info, AccountList>,

    pub system_program: Program<'info, System>,
}

impl SetAccountList<'_> {
    pub fn apply(ctx: &mut Context<SetAccountList>, params: &SetAccountListParams) -> Result<()> {
        ctx.accounts.lz_receive_types.account_list = ctx.accounts.accounts_list.key();       // update the account_list pda in lz_receive_types
        ctx.accounts.accounts_list.bump = ctx.bumps.accounts_list;
        ctx.accounts.accounts_list.withdraw_usdc_pda = params.withdraw_usdc_pda;
        ctx.accounts.accounts_list.usdc_mint = params.usdc_mint;
        ctx.accounts.accounts_list.woofi_pro_pda = params.woofi_pro_pda;
        ctx.accounts.accounts_list.withdraw_usdt_pda = params.withdraw_usdt_pda;
        ctx.accounts.accounts_list.usdt_mint = params.usdt_mint;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetAccountListParams {
    pub withdraw_usdc_pda: Pubkey,
    pub usdc_mint: Pubkey,
    pub woofi_pro_pda: Pubkey,
    pub withdraw_usdt_pda: Pubkey,
    pub usdt_mint: Pubkey,
}
