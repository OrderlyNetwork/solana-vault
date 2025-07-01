use crate::errors::VaultError;
use crate::events::{ResetAllowedBroker, SetAllowedBroker};
use crate::instructions::{bytes32_to_hex, BROKER_SEED, ACCESS_CONTROL_SEED};
use crate::state::{AllowedBroker, ManagerRole};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(params: SetBrokerParams)]
pub struct SetBroker<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,
    #[account(
        init_if_needed,
        payer = manager,
        space = 8 + AllowedBroker::INIT_SPACE,
        seeds = [BROKER_SEED, params.broker_hash.as_ref()],
        bump
    )]
    pub allowed_broker: Account<'info, AllowedBroker>,
    #[account(
        seeds = [ACCESS_CONTROL_SEED, params.role_hash.as_ref(),  manager.key().as_ref()],
        bump = manager_role.bump,
        constraint = manager_role.allowed == true @VaultError::ManagerRoleNotAllowed,
    )]
    pub manager_role: Account<'info, ManagerRole>,
    pub system_program: Program<'info, System>,
}

impl SetBroker<'_> {
    pub fn apply(ctx: &mut Context<SetBroker>, params: &SetBrokerParams) -> Result<()> {
        ctx.accounts.allowed_broker.broker_hash = params.broker_hash;
        ctx.accounts.allowed_broker.allowed = params.allowed;

        let broker_hash_hex: String = bytes32_to_hex(&params.broker_hash);
        if params.allowed {
            msg!("Setting allowed broker {:?}", broker_hash_hex);
            emit!(SetAllowedBroker {
                broker_hash: params.broker_hash,
            });
        } else {
            msg!("Resetting allowed broker {:?}", broker_hash_hex);
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
    pub role_hash: [u8; 32],
    pub broker_hash: [u8; 32],
    pub allowed: bool,
}
