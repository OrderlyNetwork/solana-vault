use crate::errors::VaultError;
use crate::events::{ResetWithdrawBrokerEvent, SetWithdrawBrokerEvent};
use crate::instructions::{bytes32_to_hex, ACCESS_CONTROL_SEED, BROKER_SEED};
use crate::state::{WithdrawBroker, ManagerRole};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(params: SetWithdrawBrokerParams)]
pub struct SetWithdrawBroker<'info> {
    #[account(mut)]
    pub broker_manager: Signer<'info>,
    #[account(
        init_if_needed,
        payer = broker_manager,
        space = 8 + WithdrawBroker::INIT_SPACE,
        seeds = [BROKER_SEED, &params.broker_index.to_be_bytes()],
        bump
    )]
    pub withdraw_broker: Account<'info, WithdrawBroker>,
    #[account(
        seeds = [ACCESS_CONTROL_SEED, params.broker_manager_role.as_ref(), broker_manager.key().as_ref()],
        bump = manager_role.bump,
        constraint = manager_role.allowed == true @VaultError::ManagerRoleNotAllowed,
    )]
    pub manager_role: Account<'info, ManagerRole>,
   
    pub system_program: Program<'info, System>,
}

impl SetWithdrawBroker<'_> {
    pub fn apply(ctx: &mut Context<SetWithdrawBroker>, params: &SetWithdrawBrokerParams) -> Result<()> {
        ctx.accounts.withdraw_broker.broker_hash = params.broker_hash;
        ctx.accounts.withdraw_broker.broker_index = params.broker_index;
        ctx.accounts.withdraw_broker.allowed = params.allowed;
        let broker_hash_hex = bytes32_to_hex(&params.broker_hash);

        if params.allowed {
            msg!("Setting withdraw broker index {:?}, broker hash {:?}", params.broker_index, broker_hash_hex);
            emit!(SetWithdrawBrokerEvent {
                broker_hash: params.broker_hash,
                broker_index: params.broker_index,
            });
        } else {
            msg!("Resetting withdraw broker index {:?}, broker hash {:?}", params.broker_index, broker_hash_hex);
            emit!(ResetWithdrawBrokerEvent {
                broker_hash: params.broker_hash,
                broker_index: params.broker_index,
            });
        }
        ctx.accounts.withdraw_broker.bump = ctx.bumps.withdraw_broker;
        
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetWithdrawBrokerParams {
    pub broker_manager_role: [u8; 32],
    pub broker_hash: [u8; 32],
    pub broker_index: u16,
    pub allowed: bool,
}
