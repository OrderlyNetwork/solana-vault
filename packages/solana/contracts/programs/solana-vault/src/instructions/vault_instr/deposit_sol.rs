use anchor_lang::prelude::*;

use oapp::endpoint::{instructions::SendParams as EndpointSendParams, MessagingReceipt};

use crate::instructions::{
    validate_account_id, DepositParams, LzMessage, MsgType, OAppSendParams, VaultDepositParams,
    BROKER_SEED, ENFORCED_OPTIONS_SEED, OAPP_SEED, PEER_SEED, SOL_VAULT_SEED, TOKEN_SEED,
    VAULT_AUTHORITY_SEED,
};

use crate::errors::VaultError;
use crate::events::{OAppSent, VaultDeposited};
use crate::state::{
    AllowedBroker, AllowedToken, EnforcedOptions, OAppConfig, Peer, VaultAuthority,
};

use crate::constants::SOL_TOKEN_HASH;

#[derive(Accounts)]
#[instruction(deposit_params: DepositParams, oapp_params: OAppSendParams)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,

    /// CHECKED: sol_vault is used for SOL deposit
    #[account(
        mut,
        seeds = [SOL_VAULT_SEED],
        bump
    )]
    pub sol_vault: UncheckedAccount<'info>,

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
        seeds = [TOKEN_SEED, SOL_TOKEN_HASH.as_ref()],
        bump = allowed_token.bump,
        constraint = allowed_token.allowed == true @ VaultError::TokenNotAllowed
    )]
    pub allowed_token: Box<Account<'info, AllowedToken>>,

    pub system_program: Program<'info, System>,
}

impl<'info> DepositSol<'info> {
    pub fn apply(
        ctx: &mut Context<'_, '_, '_, 'info, DepositSol<'info>>,
        deposit_params: &DepositParams,
        oapp_params: &OAppSendParams,
    ) -> Result<MessagingReceipt> {
        if !validate_account_id(
            &deposit_params.account_id,
            &deposit_params.user_address,
            &deposit_params.broker_hash,
        ) {
            return Err(VaultError::InvalidAccountId.into());
        }
        if deposit_params.token_amount == 0 {
            return Err(VaultError::ZeroDepositAmount.into());
        }
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.sol_vault.key(),
            deposit_params.token_amount,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.sol_vault.to_account_info(),
            ],
        )?;

        msg!("User deposited : {}", deposit_params.token_amount);

        ctx.accounts.vault_authority.deposit_nonce += 1;

        let vault_deposit_params = VaultDepositParams {
            account_id: deposit_params.account_id,
            broker_hash: deposit_params.broker_hash,
            user_address: deposit_params.user_address, //
            token_hash: SOL_TOKEN_HASH,
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
