// use crate::*;
use crate::errors::OAppError;
use crate::instructions::{get_account_id, to_bytes32};
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

    pub fn get_token_index(encoded: &[u8]) -> Result<u8> {
        let message = LzMessage::decode(encoded)?;
        if message.msg_type == MsgType::Withdraw as u8 {
            let withdraw_params = AccountWithdrawSol::decode_packed(&message.payload)?;
            return Ok(withdraw_params.token_index);
        } else {
            return Err(OAppError::InvalidMessageType.into());
        }
    }

    pub fn get_broker_index(encoded: &[u8]) -> Result<u16> {
        let message = LzMessage::decode(encoded)?;
        if message.msg_type == MsgType::Withdraw as u8 {
            let withdraw_params = AccountWithdrawSol::decode_packed(&message.payload)?;
            return Ok(withdraw_params.broker_index);
        } else {
            return Err(OAppError::InvalidMessageType.into());
        }
    }

    pub fn get_receiver_address(encoded: &[u8]) -> Result<Pubkey> {
        let message = LzMessage::decode(encoded)?;
        if message.msg_type == MsgType::Withdraw as u8 {
            let withdraw_params = AccountWithdrawSol::decode_packed(&message.payload)?;
            return Ok(Pubkey::new_from_array(withdraw_params.receiver));
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
    pub broker_index: u16,
    pub token_index: u8,
    pub token_amount: u64,
    pub fee: u64,
    pub chain_id: u64,
    pub withdraw_nonce: u64,
}

// implement the evm abi.encode and decode for AccountWithdrawSol
impl AccountWithdrawSol {
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

    pub fn decode_packed(encoded: &[u8]) -> Result<Self> {
        let mut offset = 0;
        // let account_id = encoded[offset..offset + 32].try_into().unwrap();
        // offset += 32;
        let sender = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        let receiver = encoded[offset..offset + 32].try_into().unwrap();
        offset += 32;
        // let broker_hash = encoded[offset..offset + 32].try_into().unwrap();
        // offset += 32;
        let broker_index = u16::from_be_bytes(encoded[offset..offset + 2].try_into().unwrap());
        offset += 2;
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
            broker_index,
            token_index,
            token_amount,
            fee,
            chain_id,
            withdraw_nonce,
        })
    }
}

impl AccountWithdrawSol {
    pub fn to_vault_withdraw_params(
        &self,
        broker_hash: [u8; 32],
        token_hash: [u8; 32],
    ) -> VaultWithdrawParams {
        VaultWithdrawParams {
            account_id: get_account_id(&self.sender, &broker_hash), // account_withdraw_sol.account_id
            sender: self.sender,
            receiver: self.receiver,
            broker_hash: broker_hash,
            token_hash: token_hash,
            token_amount: self.token_amount as u64,
            fee: self.fee as u128,
            chain_id: self.chain_id as u128,
            withdraw_nonce: self.withdraw_nonce,
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
