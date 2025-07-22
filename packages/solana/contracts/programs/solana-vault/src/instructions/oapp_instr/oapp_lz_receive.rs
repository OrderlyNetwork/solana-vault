use crate::errors::{OAppError, VaultError};
use crate::events::{CreatedATA, FrozenWithdrawn, VaultWithdrawn};
use crate::instructions::{OAppLzReceiveParams, AccountWithdrawSol, VaultWithdrawParams};
use crate::instructions::{
    LzMessage, MsgType, BROKER_SEED, OAPP_SEED, PEER_SEED, TOKEN_SEED, VAULT_AUTHORITY_SEED,
};
use crate::state::{AllowedBroker, WithdrawToken, OAppConfig, Peer, VaultAuthority};
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
        seeds = [BROKER_SEED, &LzMessage::decode_withdraw_params(&params.message)?.broker_hash.as_ref()],
        bump = broker_pda.bump,
    )]
    pub broker_pda: Account<'info, AllowedBroker>,
    /// CHECK
    #[account(
        // seeds = [TOKEN_SEED, &LzMessage::decode_withdraw_params(&params.message)?.token_index.to_be_bytes()],
        // bump = withdraw_token_pda.bump,
    )]
    pub withdraw_token_pda: Account<'info, WithdrawToken>,

    /// CHECK
    #[account(
        mint::token_program = token_program,
        // constraint = token_mint.key() == withdraw_token_pda.mint_account.key() @VaultError::TokenNotAllowed
    )]
    pub token_mint: Account<'info, Mint>,

    /// CHECK
    #[account()]
    pub receiver: AccountInfo<'info>,

    /// UNCHECKED
    #[account(mut)]
    pub receiver_token_account: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
    )]
    pub vault_authority: Account<'info, VaultAuthority>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

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

        if ctx.accounts.vault_authority.order_delivery {
            require!(
                params.nonce == ctx.accounts.vault_authority.inbound_nonce + 1,
                OAppError::InvalidInboundNonce
            );
        }

        ctx.accounts.vault_authority.inbound_nonce = params.nonce;

        let lz_message = LzMessage::decode(&params.message).unwrap();
        msg!("msg_type: {:?}", lz_message.msg_type);
        if lz_message.msg_type == MsgType::Withdraw as u8 {
            let withdraw_params = AccountWithdrawSol::decode_packed(&lz_message.payload).unwrap();
            require!(
                withdraw_params.receiver == ctx.accounts.receiver.key.to_bytes(),
                OAppError::InvalidReceiver
            );

            // check if the token is allowed and the mint is correct
            let (withdraw_token_pda, _) = Pubkey::find_program_address(
                &[TOKEN_SEED, &withdraw_params.token_index.to_be_bytes()],
                ctx.program_id,
            );

            if withdraw_token_pda.key() != ctx.accounts.withdraw_token_pda.key()
                || !ctx.accounts.withdraw_token_pda.allowed
            {
                return Err(VaultError::TokenNotAllowed.into());
            }
           
            require!(
                ctx.accounts.token_mint.key() == ctx.accounts.withdraw_token_pda.mint_account.key(),
                VaultError::TokenNotAllowed
            );
        

            // check if the receiver_token_account is the correct associated token account
            let receiver_ata: Pubkey = get_associated_token_address(
                ctx.accounts.receiver.key,
                &ctx.accounts.token_mint.key(),
            );
            require!(
                receiver_ata == ctx.accounts.receiver_token_account.key(),
                OAppError::InvalidReceiverTokenAccount,
            );

            // check if the broker is allowed
            let (allowed_broker, _) = Pubkey::find_program_address(
                &[BROKER_SEED, &withdraw_params.broker_hash],
                ctx.program_id,
            );

            if allowed_broker != ctx.accounts.broker_pda.key() || !ctx.accounts.broker_pda.allowed {
                return Err(VaultError::BrokerNotAllowed.into());
            }

            let amount_to_transfer = withdraw_params.token_amount - withdraw_params.fee;
            let vault_withdraw_params: VaultWithdrawParams = withdraw_params.into();

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
        } else {
            msg!("Invalid message type: {:?}", lz_message.msg_type);
        }

        Ok(())
    }
}
