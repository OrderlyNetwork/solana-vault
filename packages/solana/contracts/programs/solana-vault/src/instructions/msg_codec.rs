// use crate::*;
use crate::instructions::to_bytes32;
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
}
