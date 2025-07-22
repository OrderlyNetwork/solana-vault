// use crate::*;
use crate::instructions::{to_bytes32, get_account_id, get_usdc_hash};
use crate::errors::OAppError;
use anchor_lang::prelude::*;

pub enum MsgType {
    Deposit,
    Withdraw,
    RebalanceBurn,
    RebalanceMint,
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
    // pub fn decode(input: &[u8]) -> Result<Self> {
    //     let mut offset = 0;
    //     let account_id = input[offset..offset + 32].try_into().unwrap();
    //     offset += 32;
    //     let broker_hash = input[offset..offset + 32].try_into().unwrap();
    //     offset += 32;
    //     let user_address = input[offset..offset + 32].try_into().unwrap();
    //     offset += 32;
    //     let token_hash = input[offset..offset + 32].try_into().unwrap();
    //     offset += 32;
    //     let src_chain_id = u128::from_be_bytes(input[offset + 16..offset + 32].try_into().unwrap());
    //     let token_amount = u128::from_be_bytes(input[offset + 16..offset + 32].try_into().unwrap());
    //     let src_chain_deposit_nonce =
    //         u64::from_be_bytes(input[offset + 24..offset + 32].try_into().unwrap());

    //     Ok(Self {
    //         account_id,
    //         broker_hash,
    //         user_address,
    //         token_hash,
    //         src_chain_id,
    //         token_amount,
    //         src_chain_deposit_nonce,
    //     })
    // }

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
pub struct LzMessage {
    pub msg_type: u8,
    pub payload: Vec<u8>,
}

impl LzMessage {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoded = Vec::new();
        encoded.extend_from_slice(&self.msg_type.to_be_bytes());
        encoded.extend_from_slice(&self.payload);
        encoded
    }

    pub fn decode(encoded: &[u8]) -> Result<Self> {
        let mut offset = 0;
        let msg_type = u8::from_be_bytes(encoded[offset..offset + 1].try_into().unwrap());
        offset += 1;
        let payload: Vec<u8> = encoded[offset..].to_vec();
        Ok(Self { msg_type, payload })
    }

    pub fn decode_withdraw_params(encoded: &[u8]) -> Result<AccountWithdrawSol> {
        let message = LzMessage::decode(encoded)?;
        if message.msg_type == MsgType::Withdraw as u8 {
            let withdraw_params = AccountWithdrawSol::decode_packed(&message.payload)?;
            return Ok(withdraw_params);
        } else {
            return Err(OAppError::InvalidMessageType.into());
        }
    }
}


#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AccountWithdrawSol {
    // pub account_id: [u8; 32],
    pub sender: [u8; 32],
    pub receiver: [u8; 32],
    pub broker_hash: [u8; 32],
    pub token_index: u8,
    pub token_amount: u64,
    pub fee: u64,
    pub chain_id: u64,
    pub withdraw_nonce: u64,
}

// implement the evm abi.encode and decode for AccountWithdrawSol
impl AccountWithdrawSol {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoded = Vec::new();
        // encoded.extend_from_slice(&self.account_id);
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

    pub fn get_receiver_address(encoded: &[u8]) -> Result<Pubkey> {
        // Decode the LzMessage to get the payload
        let message = LzMessage::decode(encoded)?;

        // Decode the payload
        if message.msg_type == MsgType::Withdraw as u8 {
            let withdraw_params = AccountWithdrawSol::decode_packed(&message.payload)?;
            return Ok(Pubkey::new_from_array(withdraw_params.receiver));
        } else {
            return Ok(Pubkey::new_from_array([0u8; 32]));
        }
    }

    pub fn encode_packed(&self) -> Vec<u8> {
        let mut encoded = Vec::new();
        // encoded.extend_from_slice(&self.account_id);
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
        // let account_id = encoded[offset..offset + 32].try_into().unwrap();
        // offset += 32;
        let sender = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let receiver = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let broker_hash = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let token_index = u8::from_be_bytes(encoded[offset..offset + 1].try_into().unwrap());
        offset += 1;
        // higher 128 bits of the token amount
        let token_amount = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let fee = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let chain_id = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        offset += 8;
        let withdraw_nonce = u64::from_be_bytes(encoded[offset..offset + 8].try_into().unwrap());
        Ok(Self {
            // account_id,
            sender,
            receiver,
            broker_hash,
            token_index,
            token_amount,
            fee,
            chain_id,
            withdraw_nonce,
        })
    }

    pub fn decode(encoded: &[u8]) -> Result<Self> {
        let mut offset = 0;
        // let account_id = encoded[offset..offset + 32].try_into().unwrap();
        // offset += 32;
        let sender = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let receiver = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let broker_hash = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let token_index = u8::from_be_bytes(encoded[offset .. offset + 1].try_into().unwrap());
        offset += 1;
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
            // account_id,
            sender,
            receiver,
            broker_hash,
            token_index,
            token_amount,
            fee,
            chain_id,
            withdraw_nonce,
        })
    }
}

impl From<AccountWithdrawSol> for VaultWithdrawParams {
    fn from(account_withdraw_sol: AccountWithdrawSol) -> VaultWithdrawParams {
        VaultWithdrawParams {
            account_id: get_account_id(
                &account_withdraw_sol.sender,
                &account_withdraw_sol.broker_hash,
            ), // account_withdraw_sol.account_id
            sender: account_withdraw_sol.sender,
            receiver: account_withdraw_sol.receiver,
            broker_hash: account_withdraw_sol.broker_hash,
            token_hash: get_usdc_hash(),
            token_amount: account_withdraw_sol.token_amount as u64,
            fee: account_withdraw_sol.fee as u128,
            chain_id: account_withdraw_sol.chain_id as u128,
            withdraw_nonce: account_withdraw_sol.withdraw_nonce,
        }
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct VaultWithdrawParams {
    pub account_id: [u8; 32],
    pub sender: [u8; 32],
    pub receiver: [u8; 32],
    pub broker_hash: [u8; 32],
    pub token_hash: [u8; 32],
    pub token_amount: u64,
    pub fee: u128,
    pub chain_id: u128,
    pub withdraw_nonce: u64,
}


