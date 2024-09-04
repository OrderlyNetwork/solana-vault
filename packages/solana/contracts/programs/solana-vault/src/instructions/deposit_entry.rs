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
use crate::events::OAppSent;
use crate::oapp_instr::vault_deposit::VaultDepositParams;
use oapp::endpoint::{instructions::SendParams as EndpointSendParams, MessagingReceipt};

#[derive(Accounts)]
#[instruction(deposit_params: DepositParams, oapp_params: OAppSendParams)]
pub struct DepositEntry<'info> {
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

    #[account(
        mut,
        seeds = [
            PEER_SEED,
            &oapp_config.key().to_bytes(),
            &oapp_params.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Account<'info, Peer>,

    #[account(
        seeds = [
            ENFORCED_OPTIONS_SEED,
            &oapp_config.key().to_bytes(),
            &oapp_params.dst_eid.to_be_bytes()
        ],
        bump = enforced_options.bump
    )]
    pub enforced_options: Account<'info, EnforcedOptions>,

    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump
    )]
    pub oapp_config: Account<'info, OAppConfig>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> DepositEntry<'info> {
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
        ctx: &mut Context<'_, '_, '_, 'info, DepositEntry<'info>>,
        deposit_params: DepositParams,
        oapp_params: OAppSendParams,
    ) -> Result<MessagingReceipt> {
        require!(
            ctx.accounts.user_info.user == Pubkey::default()
                || ctx.accounts.user_info.user == ctx.accounts.user.key(),
            VaultError::UserInfoBelongsToAnotherUser
        );

        if ctx.accounts.user_info.user == Pubkey::default() {
            msg!("PDA just created, setting user field");
            ctx.accounts.user_info.user = ctx.accounts.user.key();
        }

        // msg!("Deposit: amount={}", deposit_params.token_amount);
        // msg!("Src chain id: {}", deposit_params.src_chain_id);

        msg!("DepositParams: {:?}", deposit_params);

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

        emit!(Into::<VaultDeposited>::into(vault_deposit_params.clone()));

        let receipt = oapp::endpoint_cpi::send(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.accounts.oapp_config.key(),
            ctx.remaining_accounts,
            &[OAPP_SEED, &[ctx.accounts.oapp_config.bump]],
            EndpointSendParams {
                dst_eid: oapp_params.dst_eid,
                receiver: ctx.accounts.peer.address,
                message: VaultDepositParams::encode(&vault_deposit_params),
                options: oapp_params.options.clone(),
                native_fee: oapp_params.native_fee,
                lz_token_fee: oapp_params.lz_token_fee,
            },
        )?;

        emit!(OAppSent {
            guid: receipt.guid,
            dst_eid: oapp_params.dst_eid,
        });

        Ok(receipt)
    }
}
