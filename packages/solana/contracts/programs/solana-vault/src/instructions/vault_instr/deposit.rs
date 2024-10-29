use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use oapp::endpoint::{instructions::SendParams as EndpointSendParams, MessagingReceipt};

use crate::instructions::{
    LzMessage, MsgType, VaultDepositParams, BROKER_SEED, ENFORCED_OPTIONS_SEED, OAPP_SEED,
    PEER_SEED, TOKEN_SEED, VAULT_AUTHORITY_SEED,
};

use crate::errors::VaultError;
use crate::events::{OAppSent, VaultDeposited};
use crate::state::{
    AllowedBroker, AllowedToken, EnforcedOptions, OAppConfig, Peer, VaultAuthority,
};

#[derive(Accounts)]
#[instruction(deposit_params: DepositParams, oapp_params: OAppSendParams)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = deposit_token,
        associated_token::authority = user
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = deposit_token,
        associated_token::authority = vault_authority
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        constraint = deposit_token.key() == allowed_token.mint_account @ VaultError::TokenNotAllowed,
        mint::token_program = token_program
    )]
    pub deposit_token: Box<Account<'info, Mint>>,

    #[account(
        seeds = [
            PEER_SEED,
            &oapp_config.key().to_bytes(),
            &vault_authority.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Box<Account<'info, Peer>>,

    #[account(
        seeds = [
            ENFORCED_OPTIONS_SEED,
            &oapp_config.key().to_bytes(),
            &vault_authority.dst_eid.to_be_bytes()
        ],
        bump = enforced_options.bump
    )]
    pub enforced_options: Box<Account<'info, EnforcedOptions>>,

    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump
    )]
    pub oapp_config: Box<Account<'info, OAppConfig>>,

    #[account(
        seeds = [BROKER_SEED, deposit_params.broker_hash.as_ref()],
        bump = allowed_broker.bump,
        constraint = allowed_broker.allowed == true @ VaultError::BrokerNotAllowed
    )]
    pub allowed_broker: Box<Account<'info, AllowedBroker>>,

    #[account(
        seeds = [TOKEN_SEED, deposit_params.token_hash.as_ref()],
        bump = allowed_token.bump,
        constraint = allowed_token.allowed == true @ VaultError::TokenNotAllowed
    )]
    pub allowed_token: Box<Account<'info, AllowedToken>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn transfer_token_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_token_account.to_account_info(),
            to: self.vault_token_account.to_account_info(),
            authority: self.user.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn apply(
        ctx: &mut Context<'_, '_, '_, 'info, Deposit<'info>>,
        deposit_params: &DepositParams,
        oapp_params: &OAppSendParams,
    ) -> Result<MessagingReceipt> {
        transfer(
            ctx.accounts.transfer_token_ctx(),
            deposit_params.token_amount as u128,
        )?;

        msg!("User deposited : {}", deposit_params.token_amount);

        ctx.accounts.vault_authority.deposit_nonce += 1;

        let vault_deposit_params = VaultDepositParams {
            account_id: deposit_params.account_id,
            broker_hash: deposit_params.broker_hash,
            user_address: deposit_params.user_address, //
            token_hash: deposit_params.token_hash,
            src_chain_id: ctx.accounts.vault_authority.sol_chain_id,
            token_amount: deposit_params.token_amount as u128,
            src_chain_deposit_nonce: ctx.accounts.vault_authority.deposit_nonce,
        };

        emit!(Into::<VaultDeposited>::into(vault_deposit_params.clone()));

        let seeds = &[OAPP_SEED, &[ctx.accounts.oapp_config.bump]];

        let deposit_msg = VaultDepositParams::encode(&vault_deposit_params);
        let lz_message = LzMessage::encode(&LzMessage {
            msg_type: MsgType::Deposit as u8,
            payload: deposit_msg,
        });

        let options = EnforcedOptions::get_enforced_options(&ctx.accounts.enforced_options, &None);

        let endpoint_send_params = EndpointSendParams {
            dst_eid: ctx.accounts.vault_authority.dst_eid,
            receiver: ctx.accounts.peer.address,
            message: lz_message,
            options: options,
            native_fee: oapp_params.native_fee,
            lz_token_fee: oapp_params.lz_token_fee,
        };

        let receipt = oapp::endpoint_cpi::send(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.accounts.oapp_config.key(),
            ctx.remaining_accounts,
            seeds,
            endpoint_send_params,
        )?;

        emit!(OAppSent {
            guid: receipt.guid,
            dst_eid: ctx.accounts.vault_authority.dst_eid,
        });

        Ok(receipt)
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    pub account_id: [u8; 32],
    pub broker_hash: [u8; 32],
    pub token_hash: [u8; 32],
    pub user_address: [u8; 32],
    pub token_amount: u64,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct OAppSendParams {
    pub native_fee: u64,
    pub lz_token_fee: u64,
}
