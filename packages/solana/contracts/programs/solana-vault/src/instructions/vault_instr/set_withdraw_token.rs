use crate::errors::VaultError;
use crate::events::{ResetWithdrawTokenIndex, SetWithdrawTokenIndex};
use crate::instructions::{bytes32_to_hex, ACCESS_CONTROL_SEED, TOKEN_SEED};
use crate::state::{WithdrawToken, ManagerRole};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction(params: SetWithdrawTokenParams)]
pub struct SetWithdrawToken<'info> {
    #[account(mut)]
    pub token_manager: Signer<'info>,
    #[account(
        init_if_needed,
        payer = token_manager,
        space = 8 + WithdrawToken::INIT_SPACE,
        seeds = [TOKEN_SEED, &params.token_index.to_be_bytes()],
        bump
    )]
    pub withdraw_token: Account<'info, WithdrawToken>,
    #[account(
        seeds = [ACCESS_CONTROL_SEED, params.token_manager_role.as_ref(), token_manager.key().as_ref()],
        bump = manager_role.bump,
        constraint = manager_role.allowed == true @VaultError::ManagerRoleNotAllowed,
    )]
    pub manager_role: Account<'info, ManagerRole>,
    #[account()]
    pub mint_account: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

impl SetWithdrawToken<'_> {
    pub fn apply(ctx: &mut Context<SetWithdrawToken>, params: &SetWithdrawTokenParams) -> Result<()> {
        ctx.accounts.withdraw_token.mint_account = ctx.accounts.mint_account.key();
        ctx.accounts.withdraw_token.token_hash = params.token_hash;
        ctx.accounts.withdraw_token.token_decimals = ctx.accounts.mint_account.decimals;
        ctx.accounts.withdraw_token.token_index = params.token_index;
        ctx.accounts.withdraw_token.allowed = params.allowed;
        let token_hash_hex = bytes32_to_hex(&params.token_hash);
        if params.allowed {
            msg!("Setting withdraw token index {:?}, token hash {:?}", params.token_index, token_hash_hex);
            emit!(SetWithdrawTokenIndex {
                token_index: params.token_index,
                token_hash: params.token_hash,
                mint_account: ctx.accounts.mint_account.key(),
            });
        } else {
            msg!("Resetting withdraw token index {:?}, token hash {:?}", params.token_index, token_hash_hex);
            emit!(ResetWithdrawTokenIndex {
                token_index: params.token_index,
                token_hash: params.token_hash,
                mint_account: ctx.accounts.mint_account.key(),
            });
        }
        ctx.accounts.withdraw_token.bump = ctx.bumps.withdraw_token;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetWithdrawTokenParams {
    pub token_manager_role: [u8; 32],
    pub token_hash: [u8; 32],
    pub token_index: u8,
    pub allowed: bool,
}
