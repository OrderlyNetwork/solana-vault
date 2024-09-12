use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use oapp::endpoint::{instructions::SendParams as EndpointSendParams, MessagingReceipt};

use crate::instructions::{
    to_bytes32, LzMessage, MsgType, BROKER_SEED, ENFORCED_OPTIONS_SEED, OAPP_SEED, PEER_SEED,
    TOKEN_SEED, VAULT_AUTHORITY_SEED,
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

    #[account()]
    pub deposit_token: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [
            PEER_SEED,
            &oapp_config.key().to_bytes(),
            &oapp_params.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Box<Account<'info, Peer>>,

    #[account(
        seeds = [
            ENFORCED_OPTIONS_SEED,
            &oapp_config.key().to_bytes(),
            &oapp_params.dst_eid.to_be_bytes()
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
        bump = allowed_broker.bump
    )]
    pub allowed_broker: Box<Account<'info, AllowedBroker>>,

    #[account(
        seeds = [TOKEN_SEED, deposit_params.token_hash.as_ref()],
        bump = allowed_token.bump
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
        deposit_params: DepositParams,
        oapp_params: OAppSendParams,
    ) -> Result<MessagingReceipt> {
        require!(
            ctx.accounts.allowed_broker.allowed,
            VaultError::BrokerNotAllowed
        );

        require!(
            ctx.accounts.allowed_token.allowed,
            VaultError::TokenNotAllowed
        );

        transfer(
            ctx.accounts.transfer_token_ctx(),
            deposit_params.token_amount,
        )?;

        msg!("User deposited : {}", deposit_params.token_amount);

        ctx.accounts.vault_authority.nonce += 1;

        let vault_deposit_params = VaultDepositParams {
            account_id: deposit_params.account_id,
            broker_hash: deposit_params.broker_hash,
            user_address: ctx.accounts.user.key().to_bytes(),
            token_hash: deposit_params.token_hash,
            src_chain_id: deposit_params.src_chain_id,
            token_amount: deposit_params.token_amount as u128,
            src_chain_deposit_nonce: ctx.accounts.vault_authority.nonce,
        };

        emit!(Into::<VaultDeposited>::into(vault_deposit_params.clone()));

        let seeds = &[OAPP_SEED, &[ctx.accounts.oapp_config.bump]];

        let deposit_msg = VaultDepositParams::encode(&vault_deposit_params);
        let lz_message = LzMessage::encode(&LzMessage {
            msg_type: MsgType::Deposit as u8,
            payload: deposit_msg,
        });
        let endpoint_send_params = EndpointSendParams {
            dst_eid: oapp_params.dst_eid,
            receiver: ctx.accounts.peer.address,
            message: lz_message,
            options: oapp_params.options.clone(),
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
            dst_eid: oapp_params.dst_eid,
        });

        Ok(receipt)
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

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct VaultDepositParams {
    pub account_id: [u8; 32],
    pub broker_hash: [u8; 32],
    pub user_address: [u8; 32],
    pub token_hash: [u8; 32],
    pub src_chain_id: u128,
    pub token_amount: u128,
    pub src_chain_deposit_nonce: u64,
}

impl VaultDepositParams {
    pub fn decode(input: &[u8]) -> Result<Self> {
        let mut offset = 0;
        let account_id = input[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let broker_hash = input[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let user_address = input[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let token_hash = input[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let src_chain_id = u128::from_be_bytes(input[offset + 16..offset + 32].try_into().unwrap());
        let token_amount = u128::from_be_bytes(input[offset + 16..offset + 32].try_into().unwrap());
        let src_chain_deposit_nonce =
            u64::from_be_bytes(input[offset + 24..offset + 32].try_into().unwrap());

        Ok(Self {
            account_id,
            broker_hash,
            user_address,
            token_hash,
            src_chain_id,
            token_amount,
            src_chain_deposit_nonce,
        })
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut buf = Vec::new();
        buf.extend_from_slice(&self.account_id);
        buf.extend_from_slice(&self.broker_hash);
        buf.extend_from_slice(&self.user_address);
        buf.extend_from_slice(&self.token_hash);
        buf.extend_from_slice(&to_bytes32(&self.src_chain_id.to_be_bytes()));
        buf.extend_from_slice(&to_bytes32(&self.token_amount.to_be_bytes()));
        buf.extend_from_slice(&to_bytes32(&self.src_chain_deposit_nonce.to_be_bytes()));
        buf
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct OAppSendParams {
    pub dst_eid: u32,
    pub to: [u8; 32],
    pub options: Vec<u8>,
    pub message: Option<Vec<u8>>,
    pub native_fee: u64,
    pub lz_token_fee: u64,
}
