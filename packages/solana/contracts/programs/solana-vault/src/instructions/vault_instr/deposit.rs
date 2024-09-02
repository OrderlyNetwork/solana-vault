use crate::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use crate::events::VaultDeposited;
use crate::initialize::VAULT_DEPOSIT_AUTHORITY_SEED;
use crate::vault_deposit::VaultDepositParams;

use crate::{
    state::{UserInfo, VaultDepositAuthority},
    VaultError,
};

#[derive(Accounts)]
#[instruction(deposit_params: DepositParams)]
pub struct Deposit<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserInfo::LEN,
        seeds = [user.key().as_ref()], bump
    )]
    pub user_info: Account<'info, UserInfo>,

    #[account(
        mut,
        associated_token::mint = deposit_token,
        associated_token::authority = user
    )]
    pub user_deposit_wallet: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_DEPOSIT_AUTHORITY_SEED, deposit_token.key().as_ref()],
        bump = vault_deposit_authority.bump,
        constraint = vault_deposit_authority.deposit_token == deposit_token.key()
    )]
    pub vault_deposit_authority: Account<'info, VaultDepositAuthority>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = deposit_token,
        associated_token::authority = vault_deposit_authority
    )]
    pub vault_deposit_wallet: Account<'info, TokenAccount>,

    #[account()]
    pub deposit_token: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn transfer_token_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_deposit_wallet.to_account_info(),
            to: self.vault_deposit_wallet.to_account_info(),
            authority: self.user.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn apply(
        ctx: &mut Context<'_, '_, '_, 'info, Deposit<'info>>,
        deposit_params: &DepositParams,
    ) -> Result<()> {
        require!(
            ctx.accounts.user_info.user == Pubkey::default()
                || ctx.accounts.user_info.user == ctx.accounts.user.key(),
            VaultError::UserInfoBelongsToAnotherUser
        );

        if ctx.accounts.user_info.user == Pubkey::default() {
            msg!("PDA just created, setting user field");
            ctx.accounts.user_info.user = ctx.accounts.user.key();
        }

        msg!("Deposit: amount={}", deposit_params.token_amount);

        transfer(
            ctx.accounts.transfer_token_ctx(),
            deposit_params.token_amount,
        )?;

        ctx.accounts.user_info.amount += deposit_params.token_amount;
        msg!("User deposit balance: {}", ctx.accounts.user_info.amount);

        let vault_deposit_params = VaultDepositParams {
            account_id: deposit_params.account_id,
            broker_hash: deposit_params.broker_hash,
            user_address: ctx.accounts.user.key().to_bytes(),
            token_hash: deposit_params.token_hash,
            src_chain_id: deposit_params.src_chain_id,
            token_amount: deposit_params.token_amount as u128,
            src_chain_deposit_nonce: ctx.accounts.vault_deposit_authority.nonce,
        };

        ctx.accounts.vault_deposit_authority.nonce += 1;

        emit!(Into::<VaultDeposited>::into(vault_deposit_params));

        Ok(())
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    pub account_id: [u8; 32],
    pub broker_hash: [u8; 32],
    pub token_hash: [u8; 32],
    pub src_chain_id: u128,
    pub token_amount: u64,
}
