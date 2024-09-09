use crate::errors::OAppError;
use crate::events::{ResetAllowedBroker, SetAllowedBroker};
use crate::instructions::{BROKER_SEED, OAPP_SEED};
use crate::state::{AllowedBroker, OAppConfig};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(params: SetBrokerParams)]
pub struct SetBroker<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + AllowedBroker::INIT_SPACE,
        seeds = [BROKER_SEED, params.broker_hash.as_ref()],
        bump
    )]
    pub allowed_broker: Account<'info, AllowedBroker>,
    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,
    pub system_program: Program<'info, System>,
}

impl SetBroker<'_> {
    pub fn apply(ctx: &mut Context<SetBroker>, params: &SetBrokerParams) -> Result<()> {
        ctx.accounts.allowed_broker.broker_hash = params.broker_hash;
        ctx.accounts.allowed_broker.allowed = params.allowed;
        if params.allowed {
            msg!("Setting allowed broker {:?}", params.broker_hash);
            emit!(SetAllowedBroker {
                broker_hash: params.broker_hash,
            });
        } else {
            msg!("Resetting allowed broker {:?}", params.broker_hash);
            emit!(ResetAllowedBroker {
                broker_hash: params.broker_hash,
            });
        }
        ctx.accounts.allowed_broker.bump = ctx.bumps.allowed_broker;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetBrokerParams {
    pub broker_hash: [u8; 32],
    pub allowed: bool,
}
