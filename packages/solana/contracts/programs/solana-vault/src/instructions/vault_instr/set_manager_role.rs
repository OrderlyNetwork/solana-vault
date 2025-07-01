use crate::errors::VaultError;
use crate::instructions::VAULT_AUTHORITY_SEED;
use crate::state::{VaultAuthority, ManagerRole};
use anchor_lang::prelude::*;
use crate::instructions::{ACCESS_CONTROL_SEED};


#[derive(Accounts)]
#[instruction(params: SetManagerRoleParams)]
pub struct SetManagerRole<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
        has_one = owner @ VaultError::InvalidVaultOwner
    )]
    pub vault_authority: Account<'info, VaultAuthority>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + ManagerRole::INIT_SPACE,
        seeds = [ACCESS_CONTROL_SEED, params.role_hash.as_ref(), params.manager_address.key().as_ref()], 
        bump
    )]
    pub manager_role: Account<'info, ManagerRole>,
    
    pub system_program: Program<'info, System>,
}

impl SetManagerRole<'_> {
    pub fn apply(
        ctx: &mut Context<SetManagerRole>,
        params: &SetManagerRoleParams,
    ) -> Result<()> {
        ctx.accounts.manager_role.role_hash = params.role_hash;
        ctx.accounts.manager_role.allowed = params.allowed;
        ctx.accounts.manager_role.bump = ctx.bumps.manager_role;
       Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetManagerRoleParams {
    pub role_hash: [u8; 32],
    pub manager_address: Pubkey,
    pub allowed: bool,
}

