use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use oapp::endpoint::{instructions::SendParams as EndpointSendParams, MessagingReceipt};

use crate::instructions::{
    type_utils::to_bytes32, ENFORCED_OPTIONS_SEED, OAPP_SEED, PEER_SEED,
    VAULT_DEPOSIT_AUTHORITY_SEED,
};

use crate::errors::VaultError;
use crate::events::{OAppSent, VaultDeposited};
use crate::state::{EnforcedOptions, OAppConfig, Peer, UserInfo, VaultDepositAuthority};

#[derive(Accounts)]
#[instruction(deposit_params: DepositParams, oapp_params: OAppSendParams)]
pub struct Deposit<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserInfo::LEN,
        seeds = [user.key().as_ref()], bump
    )]
    pub user_info: Box<Account<'info, UserInfo>>,

    #[account(
        mut,
        associated_token::mint = deposit_token,
        associated_token::authority = user
    )]
    pub user_deposit_wallet: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [VAULT_DEPOSIT_AUTHORITY_SEED, deposit_token.key().as_ref()],
        bump = vault_deposit_authority.bump,
        constraint = vault_deposit_authority.deposit_token == deposit_token.key()
    )]
    pub vault_deposit_authority: Box<Account<'info, VaultDepositAuthority>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = deposit_token,
        associated_token::authority = vault_deposit_authority
    )]
    pub vault_deposit_wallet: Box<Account<'info, TokenAccount>>,

    #[account()]
    pub deposit_token: Box<Account<'info, Mint>>,

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
