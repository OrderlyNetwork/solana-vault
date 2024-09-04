use crate::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use crate::deposit::DepositParams;
use crate::events::VaultDeposited;
use crate::init_vault::VAULT_DEPOSIT_AUTHORITY_SEED;
use crate::{
    state::{UserInfo, VaultDepositAuthority},
    VaultError,
};
use oapp_send::OAppSendParams;
// use orderly_oapp_interface::{cpi::accounts::VaultDeposit, VaultDepositParams};
use crate::oapp_instr::vault_deposit::VaultDepositParams;

#[derive(Accounts)]
#[instruction(deposit_params: DepositParams, oapp_params: OAppSendParams)]
pub struct DepositOapp<'info> {
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

impl<'info> DepositOapp<'info> {
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
        ctx: &mut Context<'_, '_, '_, 'info, DepositOapp<'info>>,
        deposit_params: &DepositParams,
        oapp_params: OAppSendParams,
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

        // Making call to orderly_oapp::cpi::vault_deposit

        // let orderly_vault_deposit_accounts = VaultDeposit {
        //     signer: ctx.accounts.user.to_account_info(),
        //     program: ctx.remaining_accounts[0].to_account_info(), // first remaining account is orderly_oapp program
        //     event_authority: ctx.remaining_accounts[1].to_account_info(), // I'm not sure what this account is
        //     peer: ctx.remaining_accounts[2].to_account_info(), // second remaining account is peer account
        //     enforced_options: ctx.remaining_accounts[3].to_account_info(), // third remaining account is enforced_options account
        //     oapp_config: ctx.remaining_accounts[4].to_account_info(), // fourth remaining account is oapp_config account
        // };
        // let mut orderly_vault_deposit_ctx = CpiContext::new(
        //     ctx.remaining_accounts[0].to_account_info(),
        //     orderly_vault_deposit_accounts,
        // );
        // orderly_vault_deposit_ctx.remaining_accounts = ctx.remaining_accounts[5..].to_vec();

        // orderly_oapp_interface::cpi::vault_deposit(
        //     orderly_vault_deposit_ctx,
        //     vault_deposit_params.clone(),
        //     oapp_params.clone(),
        // )?;

        emit!(Into::<VaultDeposited>::into(vault_deposit_params));

        Ok(())
    }
}
