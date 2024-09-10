use crate::errors::OAppError;
use crate::events::{ResetAllowedToken, SetAllowedToken};
use crate::instructions::{OAPP_SEED, TOKEN_SEED};
use crate::state::{AllowedToken, OAppConfig};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
#[instruction(params: SetTokenParams)]
pub struct SetToken<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + AllowedToken::INIT_SPACE,
        seeds = [TOKEN_SEED, mint_account.key().as_ref(), params.token_hash.as_ref()],
        bump
    )]
    pub allowed_token: Account<'info, AllowedToken>,
    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    #[account()]
    pub mint_account: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

impl SetToken<'_> {
    pub fn apply(ctx: &mut Context<SetToken>, params: &SetTokenParams) -> Result<()> {
        ctx.accounts.allowed_token.mint_account = params.mint_account;
        ctx.accounts.allowed_token.token_hash = params.token_hash;
        ctx.accounts.allowed_token.token_decimals = ctx.accounts.mint_account.decimals;
        ctx.accounts.allowed_token.allowed = params.allowed;
        if params.allowed {
            msg!("Setting allowed token {:?}", params.token_hash);
            emit!(SetAllowedToken {
                token_hash: params.token_hash,
                mint_account: params.mint_account,
            });
        } else {
            msg!("Resetting allowed token {:?}", params.token_hash);
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
    pub mint_account: Pubkey,
    pub token_hash: [u8; 32],
    pub allowed: bool,
}
