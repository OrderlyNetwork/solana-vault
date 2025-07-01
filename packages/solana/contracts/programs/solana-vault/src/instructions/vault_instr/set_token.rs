use crate::errors::VaultError;
use crate::events::{ResetAllowedToken, SetAllowedToken};
use crate::instructions::{bytes32_to_hex, ACCESS_CONTROL_SEED, TOKEN_SEED};
use crate::state::{AllowedToken, OAppConfig, ManagerRole};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction(params: SetTokenParams)]
pub struct SetToken<'info> {
    #[account(mut)]
    pub token_manager: Signer<'info>,
    #[account(
        init_if_needed,
        payer = token_manager,
        space = 8 + AllowedToken::INIT_SPACE,
        seeds = [TOKEN_SEED, params.token_hash.as_ref()], // mint_account.key().as_ref(), 
        bump
    )]
    pub allowed_token: Account<'info, AllowedToken>,
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

impl SetToken<'_> {
    pub fn apply(ctx: &mut Context<SetToken>, params: &SetTokenParams) -> Result<()> {
        ctx.accounts.allowed_token.mint_account = ctx.accounts.mint_account.key();
        ctx.accounts.allowed_token.token_hash = params.token_hash;
        ctx.accounts.allowed_token.token_decimals = ctx.accounts.mint_account.decimals;
        ctx.accounts.allowed_token.allowed = params.allowed;
        let token_hash_hex = bytes32_to_hex(&params.token_hash);
        if params.allowed {
            msg!("Setting allowed token {:?}", token_hash_hex);
            emit!(SetAllowedToken {
                token_hash: params.token_hash,
                mint_account: params.mint_account,
            });
        } else {
            msg!("Resetting allowed token {:?}", token_hash_hex);
            emit!(ResetAllowedToken {
                token_hash: params.token_hash,
                mint_account: params.mint_account,
            });
        }
        ctx.accounts.allowed_token.bump = ctx.bumps.allowed_token;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetTokenParams {
    pub token_manager_role: [u8; 32],
    pub mint_account: Pubkey,
    pub token_hash: [u8; 32],
    pub allowed: bool,
}
