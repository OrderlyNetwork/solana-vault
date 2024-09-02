use crate::*;
use cc_encode::to_bytes32;
use oapp::endpoint::{cpi::accounts::Clear, instructions::ClearParams, ConstructCPIContext};

#[event_cpi]
#[derive(Accounts)]
#[instruction(params: OAppLzReceiveParams)]
pub struct OAppLzReceive<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
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
    pub system_program: Program<'info, System>,
}

impl OAppLzReceive<'_> {
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
        // return Ok(());
        let vault_program_account =
            ctx.remaining_accounts[Clear::MIN_ACCOUNTS_LEN].to_account_info();
        let withdraw_accounts = &ctx.remaining_accounts[Clear::MIN_ACCOUNTS_LEN + 1..];

        // let withdraw_ctx = vault_interface::cpi::accounts::Withdraw {
        // let withdraw_ctx = vault::cpi::accounts::Withdraw {
        //     user: withdraw_accounts[0].to_account_info(),
        //     user_info: withdraw_accounts[1].to_account_info(),
        //     user_deposit_wallet: withdraw_accounts[2].to_account_info(),
        //     vault_deposit_authority: withdraw_accounts[3].to_account_info(),
        //     vault_deposit_wallet: withdraw_accounts[4].to_account_info(),
        //     deposit_token: withdraw_accounts[5].to_account_info(),
        //     token_program: withdraw_accounts[6].to_account_info(),
        // };

        // let withdraw_params = AccountWithdrawSol::decode_packed(&params.message).unwrap();

        // let cpi_ctx = anchor_lang::context::CpiContext::new(vault_program_account, withdraw_ctx);

        // match vault_interface::cpi::withdraw(cpi_ctx, withdraw_params.into()) {
        // match vault::cpi::withdraw(cpi_ctx, withdraw_params.into()) {
        //     Ok(_) => {
        //         emit_cpi!(OAppReceived {
        //             guid: params.guid,
        //             src_eid: params.src_eid,
        //         });
        //     },
        //     Err(e) => {
        //         // return error
        //         return Err(e.into());
        //     }
        // }

        Ok(())
    }
}

// struct AccountWithdrawSol {
//     bytes32 accountId;
//     bytes32 sender;
//     bytes32 receiver;
//     bytes32 brokerHash;
//     bytes32 tokenHash;
//     uint128 tokenAmount;
//     uint128 fee;
//     uint256 chainId;
//     uint64 withdrawNonce;
// }

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AccountWithdrawSol {
    pub account_id: [u8; 32],
    pub sender: [u8; 32],
    pub receiver: [u8; 32],
    pub broker_hash: [u8; 32],
    pub token_amount: u64,
    pub fee: u64,
    pub chain_id: u64,
    pub withdraw_nonce: u64,
}

// implement the evm abi.encode and decode for AccountWithdrawSol
impl AccountWithdrawSol {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoded = Vec::new();
        encoded.extend_from_slice(&self.account_id);
        encoded.extend_from_slice(&self.sender);
        encoded.extend_from_slice(&self.receiver);
        encoded.extend_from_slice(&self.broker_hash);
        // encoded.extend_from_slice(&self.token_hash);
        encoded.extend_from_slice(&to_bytes32(&self.token_amount.to_be_bytes()));
        encoded.extend_from_slice(&to_bytes32(&self.fee.to_be_bytes()));
        encoded.extend_from_slice(&to_bytes32(&self.chain_id.to_be_bytes()));
        encoded.extend_from_slice(&to_bytes32(&self.withdraw_nonce.to_be_bytes()));
        encoded
    }

    pub fn encode_packed(&self) -> Vec<u8> {
        let mut encoded = Vec::new();
        encoded.extend_from_slice(&self.account_id);
        encoded.extend_from_slice(&self.sender);
        encoded.extend_from_slice(&self.receiver);
        encoded.extend_from_slice(&self.broker_hash);
        // encoded.extend_from_slice(&self.token_hash);
        encoded.extend_from_slice(&self.token_amount.to_be_bytes());
        encoded.extend_from_slice(&self.fee.to_be_bytes());
        encoded.extend_from_slice(&self.chain_id.to_be_bytes());
        encoded.extend_from_slice(&self.withdraw_nonce.to_be_bytes());
        encoded
    }

    pub fn decode_packed(encoded: &[u8]) -> Result<Self> {
        let mut offset = 0;
        let account_id = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let sender = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let receiver = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let broker_hash = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        // let token_hash = encoded[offset..offset + 32].try_into().unwrap();
        // offset += 32;
        // higher 128 bits of the token amount
        let token_amount = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let fee = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let chain_id = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let withdraw_nonce = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        Ok(Self {
            account_id,
            sender,
            receiver,
            broker_hash,
            token_amount,
            fee,
            chain_id,
            withdraw_nonce,
        })
    }

    pub fn decode(encoded: &[u8]) -> Result<Self> {
        let mut offset = 0;
        let account_id = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let sender = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let receiver = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let broker_hash = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        // let token_hash = encoded[offset..offset + 32].try_into().unwrap();
        // offset += 32;
        // higher 128 bits of the token amount
        let token_amount =
            u64::from_be_bytes(encoded[offset + 24..offset + 32].try_into().unwrap());
        offset += 32;
        let fee = u64::from_be_bytes(encoded[offset + 24..offset + 32].try_into().unwrap());
        offset += 32;
        let chain_id = u64::from_be_bytes(encoded[offset + 24..offset + 32].try_into().unwrap());
        offset += 32;
        let withdraw_nonce =
            u64::from_be_bytes(encoded[offset + 24..offset + 32].try_into().unwrap());
        Ok(Self {
            account_id,
            sender,
            receiver,
            broker_hash,
            token_amount,
            fee,
            chain_id,
            withdraw_nonce,
        })
    }
}

impl From<AccountWithdrawSol> for vault_instr::withdraw::VaultWithdrawParams {
    fn from(account_withdraw_sol: AccountWithdrawSol) -> VaultWithdrawParams {
        // 0xd6aca1be9729c13d677335161321649cccae6a591554772516700f986f942eaa
        // token hash from hex string
        let hex_string = "d6aca1be9729c13d677335161321649cccae6a591554772516700f986f942eaa";
        let token_hash: [u8; 32] = hex::decode(&hex_string).unwrap().try_into().unwrap();

        VaultWithdrawParams {
            account_id: account_withdraw_sol.account_id,
            sender: account_withdraw_sol.sender,
            receiver: account_withdraw_sol.receiver,
            broker_hash: account_withdraw_sol.broker_hash,
            token_hash,
            token_amount: account_withdraw_sol.token_amount as u64,
            fee: account_withdraw_sol.fee as u128,
            chain_id: account_withdraw_sol.chain_id as u128,
            withdraw_nonce: account_withdraw_sol.withdraw_nonce,
        }
    }
}

// test code
#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_account_withdraw_sol_encode_decode() {
        let account_withdraw_sol = AccountWithdrawSol {
            account_id: [1u8; 32],
            sender: [2u8; 32],
            receiver: [3u8; 32],
            broker_hash: [4u8; 32],
            // token_hash: [5u8; 32],
            token_amount: 1000,
            fee: 10,
            chain_id: 1,
            withdraw_nonce: 1,
        };
        let encoded = account_withdraw_sol.encode();
        // print the encoded bytes in hex format
        // println!("{:x?}", encoded);
        let decoded = AccountWithdrawSol::decode(&encoded).unwrap();
        assert_eq!(account_withdraw_sol.account_id, decoded.account_id);
        assert_eq!(account_withdraw_sol.sender, decoded.sender);
        assert_eq!(account_withdraw_sol.receiver, decoded.receiver);
        assert_eq!(account_withdraw_sol.broker_hash, decoded.broker_hash);
        // assert_eq!(account_withdraw_sol.token_hash, decoded.token_hash);
        assert_eq!(account_withdraw_sol.token_amount, decoded.token_amount);
        assert_eq!(account_withdraw_sol.fee, decoded.fee);
        assert_eq!(account_withdraw_sol.chain_id, decoded.chain_id);
        assert_eq!(account_withdraw_sol.withdraw_nonce, decoded.withdraw_nonce);
    }

    #[test]
    fn test_account_withdraw_sol_encode_decode_packed() {
        let account_withdraw_sol = AccountWithdrawSol {
            account_id: [1u8; 32],
            sender: [2u8; 32],
            receiver: [3u8; 32],
            broker_hash: [4u8; 32],
            // token_hash: [5u8; 32],
            token_amount: 1000,
            fee: 10,
            chain_id: 1,
            withdraw_nonce: 1,
        };
        let encoded = account_withdraw_sol.encode_packed();

        // print length of encoded
        println!("length of encoded: {:?}", encoded.len());
        // print the encoded bytes in hex string
        println!("encoded: {:?}", hex::encode(&encoded));

        // print the encoded bytes in hex format
        // println!("{:x?}", encoded);
        let decoded = AccountWithdrawSol::decode_packed(&encoded).unwrap();
        assert_eq!(account_withdraw_sol.account_id, decoded.account_id);
        assert_eq!(account_withdraw_sol.sender, decoded.sender);
        assert_eq!(account_withdraw_sol.receiver, decoded.receiver);
        assert_eq!(account_withdraw_sol.broker_hash, decoded.broker_hash);
        // assert_eq!(account_withdraw_sol.token_hash, decoded.token_hash);
        assert_eq!(account_withdraw_sol.token_amount, decoded.token_amount);
        assert_eq!(account_withdraw_sol.fee, decoded.fee);
        assert_eq!(account_withdraw_sol.chain_id, decoded.chain_id);
        assert_eq!(account_withdraw_sol.withdraw_nonce, decoded.withdraw_nonce);
    }

    #[test]
    fn test_decode_cross_chain_msg() {
        let account_id: [u8; 32] = [
            226, 45, 187, 110, 76, 25, 151, 127, 51, 25, 214, 54, 34, 8, 181, 102, 166, 34, 59,
            204, 54, 214, 252, 22, 163, 52, 72, 235, 230, 27, 184, 32,
        ];
        let sender: [u8; 32] = [
            197, 197, 198, 154, 243, 143, 35, 186, 171, 130, 214, 237, 91, 67, 205, 5, 160, 40, 36,
            59, 238, 205, 115, 218, 150, 35, 242, 63, 204, 186, 125, 235,
        ];
        let receiver: [u8; 32] = [
            154, 198, 82, 111, 13, 161, 35, 64, 235, 21, 18, 177, 237, 133, 228, 188, 19, 181, 199,
            83, 108, 69, 111, 25, 180, 206, 199, 51, 36, 31, 245, 185,
        ];
        let broker_hash: [u8; 32] = [
            8, 48, 152, 197, 147, 243, 149, 190, 161, 222, 69, 221, 165, 82, 217, 241, 78, 143,
            203, 11, 227, 250, 170, 122, 25, 3, 197, 71, 125, 123, 167, 253,
        ];
        let token_amount: u64 = 64;
        let fee: u64 = 10;
        let chain_id: u64 = 901901901;
        let withdraw_nonce: u64 = 1;
        let account_withdraw_sol = AccountWithdrawSol {
            account_id,
            sender,
            receiver,
            broker_hash,
            token_amount,
            fee,
            chain_id,
            withdraw_nonce,
        };
        let encoded = account_withdraw_sol.encode_packed();
        // print encoded as hex string
        println!("encoded: {:?}", hex::encode(&encoded));
        let _decoded = AccountWithdrawSol::decode_packed(&encoded).unwrap();
    }
}
