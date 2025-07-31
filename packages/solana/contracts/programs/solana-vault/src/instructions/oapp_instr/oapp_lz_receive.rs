use crate::errors::{OAppError, VaultError};
use crate::events::{CreatedATA, FrozenWithdrawn, VaultWithdrawn};
use crate::instructions::{OAppLzReceiveParams, AccountWithdrawSol, VaultWithdrawParams};
use crate::instructions::{
    LzMessage, MsgType, BROKER_SEED, OAPP_SEED, PEER_SEED, TOKEN_SEED, VAULT_AUTHORITY_SEED, SOL_VAULT_SEED,
};
use crate::constants::{TOKEN_INDEX_SOL};
use crate::state::{AllowedBroker, WithdrawToken, OAppConfig, Peer, VaultAuthority, WithdrawBroker};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::{create, get_associated_token_address, AssociatedToken, Create};
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};
use oapp::endpoint::{cpi::accounts::Clear, instructions::ClearParams, ConstructCPIContext};

#[event_cpi]
#[derive(Accounts)]
#[instruction(params: OAppLzReceiveParams)]
pub struct OAppLzReceive<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [
            PEER_SEED,
            &oapp_config.key().to_bytes(),
            &params.src_eid.to_be_bytes()
        ],
        bump = peer.bump,
        constraint = peer.address == params.sender @OAppError::InvalidSender
    )]
    pub peer: Account<'info, Peer>,

    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump
    )]
    pub oapp_config: Account<'info, OAppConfig>,

    #[account(
        seeds = [BROKER_SEED, &LzMessage::get_broker_index(&params.message)?.to_be_bytes()],
        bump = withdraw_broker_pda.bump,
        constraint = withdraw_broker_pda.allowed @VaultError::BrokerNotAllowed
    )]
    pub withdraw_broker_pda: Account<'info, WithdrawBroker>,
    /// CHECK
    #[account(
        seeds = [TOKEN_SEED, &LzMessage::get_token_index(&params.message)?.to_be_bytes()],
        bump = withdraw_token_pda.bump,
        constraint = withdraw_token_pda.allowed @VaultError::TokenNotAllowed
    )]
    pub withdraw_token_pda: Account<'info, WithdrawToken>,
    /// CHECK
    #[account(
        mint::token_program = token_program,
        constraint = token_mint.key() == withdraw_token_pda.mint_account.key() @VaultError::TokenNotAllowed
    )]
    pub token_mint: Account<'info, Mint>,
    /// CHECK
    #[account(
        mut,
        constraint = LzMessage::get_receiver_address(&params.message)? == receiver.key() @OAppError::InvalidReceiver
    )]
    pub receiver: AccountInfo<'info>,
    /// UNCHECKED
    #[account(mut)]
    pub receiver_token_account: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
        constraint = vault_authority.check_nonce(params.nonce) == true @OAppError::InvalidInboundNonce
    )]
    pub vault_authority: Account<'info, VaultAuthority>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    /// CHECKED: sol_vault is used for SOL withdrawal
    #[account(
        mut,
        seeds = [SOL_VAULT_SEED],
        bump,
    )]
    pub sol_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> OAppLzReceive<'info> {
    fn transfer_token_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_token_account.to_account_info(),
            to: self.receiver_token_account.to_account_info(),
            authority: self.vault_authority.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn apply(ctx: &mut Context<OAppLzReceive>, params: &OAppLzReceiveParams) -> Result<()> {
        let seeds: &[&[u8]] = &[OAPP_SEED, &[ctx.accounts.oapp_config.bump]];

        let accounts_for_clear = &ctx.remaining_accounts[0..Clear::MIN_ACCOUNTS_LEN];
        let _ = oapp::endpoint_cpi::clear(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.accounts.oapp_config.key(),
            accounts_for_clear,
            seeds,
            ClearParams {
                receiver: ctx.accounts.oapp_config.key(),
                src_eid: params.src_eid,
                sender: params.sender,
                nonce: params.nonce,
                guid: params.guid,
                message: params.message.clone(),
            },
        )?;

        ctx.accounts.vault_authority.inbound_nonce = params.nonce;

        let lz_message = LzMessage::decode(&params.message).unwrap();
        msg!("msg_type: {:?}", lz_message.msg_type);
        if lz_message.msg_type == MsgType::Withdraw as u8 {
            let withdraw_params = AccountWithdrawSol::decode_packed(&lz_message.payload).unwrap();

            // check if the receiver_token_account is the correct associated token account
            let receiver_ata: Pubkey = get_associated_token_address(
                ctx.accounts.receiver.key,
                &ctx.accounts.token_mint.key(),
            );
            require!(
                receiver_ata == ctx.accounts.receiver_token_account.key(),
                OAppError::InvalidReceiverTokenAccount,
            );

            let token_index = withdraw_params.token_index;
            let amount_to_transfer = withdraw_params.token_amount - withdraw_params.fee;
            let vault_withdraw_params: VaultWithdrawParams = withdraw_params.to_vault_withdraw_params(ctx.accounts.withdraw_broker_pda.broker_hash, ctx.accounts.withdraw_token_pda.token_hash);

            if token_index == TOKEN_INDEX_SOL {
                // transfer SOL to the receiver
                let ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.sol_vault.to_account_info().key(),
                    &ctx.accounts.receiver.key(),
                    amount_to_transfer,
                );
                let seeds = &[SOL_VAULT_SEED, &[ctx.bumps.sol_vault]];
                anchor_lang::solana_program::program::invoke_signed(
                    &ix,
                    &[
                        ctx.accounts.sol_vault.to_account_info(),
                        ctx.accounts.receiver.to_account_info(),
                    ],
                    &[&seeds[..]],
                )?;

                emit!(Into::<VaultWithdrawn>::into(vault_withdraw_params.clone()))

                
            } else {
                // if the receiver_token_account is empty, create a new ATA
                if ctx.accounts.receiver_token_account.data_is_empty() {
                    let cpi_accounts = Create {
                        payer: ctx.accounts.payer.to_account_info(),
                        associated_token: ctx.accounts.receiver_token_account.to_account_info(),
                        authority: ctx.accounts.receiver.to_account_info(),
                        mint: ctx.accounts.token_mint.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                    };
                    let cpi_ctx = CpiContext::new(
                        ctx.accounts.associated_token_program.to_account_info(),
                        cpi_accounts,
                    );
                    create(cpi_ctx)?;
                    emit!(CreatedATA {
                        account_id: vault_withdraw_params.account_id,
                        receiver: vault_withdraw_params.receiver,
                        receiver_token_account: ctx.accounts.receiver_token_account.key().to_bytes(),
                        withdraw_nonce: vault_withdraw_params.withdraw_nonce,
                    });
                }

                let ata_data: &Vec<u8> = &(ctx.accounts.receiver_token_account.data).borrow().to_vec();
                let ata_account = TokenAccount::try_deserialize(&mut &ata_data[..]).unwrap();

                if ata_account.is_frozen() {
                    emit!(Into::<FrozenWithdrawn>::into(vault_withdraw_params.clone()));
                } else {
                    let vault_authority_seeds =
                        &[VAULT_AUTHORITY_SEED, &[ctx.accounts.vault_authority.bump]];
                    transfer(
                        ctx.accounts
                            .transfer_token_ctx()
                            .with_signer(&[&vault_authority_seeds[..]]),
                        amount_to_transfer,
                    )?;
                    emit!(Into::<VaultWithdrawn>::into(vault_withdraw_params.clone()));
                }
            }
        } else {
            msg!("Invalid message type: {:?}", lz_message.msg_type);
        }

        Ok(())
    }
}
