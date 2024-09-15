use crate::*;

// Vault event

#[event]
pub struct SetAllowedBroker {
    pub broker_hash: [u8; 32],
}

#[event]
pub struct ResetAllowedBroker {
    pub broker_hash: [u8; 32],
}

#[event]
pub struct SetAllowedToken {
    pub token_hash: [u8; 32],
    pub mint_account: Pubkey,
}

#[event]
pub struct ResetAllowedToken {
    pub token_hash: [u8; 32],
    pub mint_account: Pubkey,
}

#[event]
pub struct Deposited {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct VaultDeposited {
    pub account_id: [u8; 32],
    pub broker_hash: [u8; 32],
    pub user_address: [u8; 32],
    pub token_hash: [u8; 32],
    pub src_chain_id: u128,
    pub token_amount: u64,
    pub src_chain_deposit_nonce: u64,
}

impl From<VaultDepositParams> for VaultDeposited {
    fn from(vault_deposit_parms: VaultDepositParams) -> VaultDeposited {
        VaultDeposited {
            account_id: vault_deposit_parms.account_id,
            broker_hash: vault_deposit_parms.broker_hash,
            user_address: vault_deposit_parms.user_address,
            token_hash: vault_deposit_parms.token_hash,
            src_chain_id: vault_deposit_parms.src_chain_id,
            token_amount: vault_deposit_parms.token_amount as u64,
            src_chain_deposit_nonce: vault_deposit_parms.src_chain_deposit_nonce,
        }
    }
}

#[event]
pub struct VaultWithdrawn {
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

impl From<VaultWithdrawParams> for VaultWithdrawn {
    fn from(account_withdraw_params: VaultWithdrawParams) -> VaultWithdrawn {
        VaultWithdrawn {
            account_id: account_withdraw_params.account_id,
            sender: account_withdraw_params.sender,
            receiver: account_withdraw_params.receiver,
            broker_hash: account_withdraw_params.broker_hash,
            token_hash: account_withdraw_params.token_hash,
            token_amount: account_withdraw_params.token_amount,
            fee: account_withdraw_params.fee,
            chain_id: account_withdraw_params.chain_id,
            withdraw_nonce: account_withdraw_params.withdraw_nonce,
        }
    }
}

// OApp events
#[event]
pub struct OAppSent {
    pub guid: [u8; 32],
    pub dst_eid: u32,
}

#[event]
pub struct OAppReceived {
    pub guid: [u8; 32],
    pub src_eid: u32,
}
