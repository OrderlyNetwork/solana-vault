use crate::init_vault::VAULT_DEPOSIT_AUTHORITY_SEED;
use crate::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};
use events::VaultWithdrawn;

use crate::{
    state::{UserInfo, VaultDepositAuthority},
    VaultError,
};

#[derive(Accounts)]
#[instruction(withdraw_params: VaultWithdrawParams)]
pub struct Withdraw<'info> {
    /// CHECK: The user withdrawing funds.
    #[account()]
    pub user: AccountInfo<'info>,

    #[account(mut, has_one = user)]
    pub user_info: Account<'info, UserInfo>,

    #[account(
        mut,
        associated_token::mint = deposit_token,
        associated_token::authority = user
    )]
    pub user_deposit_wallet: Account<'info, TokenAccount>,

    #[account(
        seeds = [VAULT_DEPOSIT_AUTHORITY_SEED, deposit_token.key().as_ref()],
        bump = vault_deposit_authority.bump,
        constraint = vault_deposit_authority.deposit_token == deposit_token.key()
    )]
    pub vault_deposit_authority: Account<'info, VaultDepositAuthority>,

    #[account(
        mut,
        associated_token::mint = deposit_token,
        associated_token::authority = vault_deposit_authority
    )]
    pub vault_deposit_wallet: Account<'info, TokenAccount>,

    #[account()]
    pub deposit_token: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Withdraw<'info> {
    fn transfer_token_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_deposit_wallet.to_account_info(),
            to: self.user_deposit_wallet.to_account_info(),
            authority: self.vault_deposit_authority.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn apply(ctx: &mut Context<Withdraw>, withdraw_params: &VaultWithdrawParams) -> Result<()> {
        require!(
            ctx.accounts.user_info.amount >= withdraw_params.token_amount,
            VaultError::InsufficientFunds
        );

        let deposit_token_key = ctx.accounts.deposit_token.key();
        let vault_deposit_authority_seeds = &[
            VAULT_DEPOSIT_AUTHORITY_SEED,
            deposit_token_key.as_ref(),
            &[ctx.accounts.vault_deposit_authority.bump],
        ];

        msg!("Withdraw amount = {}", withdraw_params.token_amount);

        transfer(
            ctx.accounts
                .transfer_token_ctx()
                .with_signer(&[&vault_deposit_authority_seeds[..]]),
            withdraw_params.token_amount,
        )?;

        ctx.accounts.user_info.amount -= withdraw_params.token_amount;
        msg!("User deposit balance: {}", ctx.accounts.user_info.amount);

        emit!(Into::<VaultWithdrawn>::into(withdraw_params.clone()));

        Ok(())
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct VaultWithdrawParams {
    pub account_id: [u8; 32],
    pub sender: [u8; 32],
    pub receiver: [u8; 32],
    pub broker_hash: [u8; 32],
    pub token_hash: [u8; 32],
    pub token_amount: u64,
    pub fee: u128,
    pub chain_id: u128,
    pub withdraw_nonce: u64,
}
