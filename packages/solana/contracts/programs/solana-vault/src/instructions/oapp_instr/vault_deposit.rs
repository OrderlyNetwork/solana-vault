use crate::*;
use cc_encode::to_bytes32;
use oapp::endpoint::{instructions::SendParams as EndpointSendParams, MessagingReceipt};

#[event_cpi]
#[derive(Accounts)]
#[instruction(params: VaultDepositParams, oapp_params: OAppSendParams)]
pub struct VaultDeposit<'info> {
    pub signer: Signer<'info>,
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
}

// AccountTypes
// struct AccountDepositSol {
//     bytes32 accountId;
//     bytes32 brokerHash;
//     bytes32 userAddress;
//     bytes32 tokenHash;
//     uint256 srcChainId;
//     uint128 tokenAmount;
//     uint64 srcChainDepositNonce;
// }
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

impl VaultDeposit<'_> {
    pub fn apply(
        ctx: &mut Context<VaultDeposit>,
        params: &VaultDepositParams,
        oapp_params: &OAppSendParams,
    ) -> Result<MessagingReceipt> {
        let receipt = oapp::endpoint_cpi::send(
            ctx.accounts.oapp_config.endpoint_program,
            ctx.accounts.oapp_config.key(),
            ctx.remaining_accounts,
            &[OAPP_SEED, &[ctx.accounts.oapp_config.bump]],
            EndpointSendParams {
                dst_eid: oapp_params.dst_eid,
                receiver: ctx.accounts.peer.address,
                message: VaultDepositParams::encode(params),
                options: oapp_params.options.clone(),
                native_fee: oapp_params.native_fee,
                lz_token_fee: oapp_params.lz_token_fee,
            },
        )?;

        emit_cpi!(OAppSent {
            guid: receipt.guid,
            dst_eid: oapp_params.dst_eid,
        });

        Ok(receipt)
    }
}
