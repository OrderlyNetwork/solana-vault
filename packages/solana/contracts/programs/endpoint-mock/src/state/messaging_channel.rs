use crate::*;

pub const EMPTY_PAYLOAD_HASH: [u8; 32] = [0u8; 32];
pub const NIL_PAYLOAD_HASH: [u8; 32] = [0xffu8; 32];

pub const PENDING_INBOUND_NONCE_MAX_LEN: u64 = 256;

#[account]
#[derive(InitSpace)]
pub struct Nonce {
    pub bump: u8,
    pub outbound_nonce: u64,
    pub inbound_nonce: u64,
}

impl Nonce {
    /// update the inbound_nonce to the max nonce, to which the pending_inbound_nonces are continuous
    /// from the current inbound_nonce
    pub fn update_inbound_nonce(&mut self, pending_inbound_nonce: &mut PendingInboundNonce) {
        let mut new_inbound_nonce = self.inbound_nonce;
        for nonce in pending_inbound_nonce.nonces.iter() {
            if *nonce == new_inbound_nonce + 1 {
                new_inbound_nonce = *nonce;
            } else {
                break;
            }
        }

        if new_inbound_nonce > self.inbound_nonce {
            let diff = new_inbound_nonce - self.inbound_nonce;
            self.inbound_nonce = new_inbound_nonce;
            pending_inbound_nonce.nonces.drain(0..diff as usize);
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct PendingInboundNonce {
    #[max_len(PENDING_INBOUND_NONCE_MAX_LEN)]
    pub nonces: Vec<u64>,
    pub bump: u8,
}

impl PendingInboundNonce {
    /// Insert a new nonce into the pending inbound nonce list if it doesn't already exist.
    pub fn insert_pending_inbound_nonce(
        &mut self,
        new_inbound_nonce: u64,
        nonce: &mut Nonce,
    ) -> Result<()> {
        require!(
            nonce.inbound_nonce < new_inbound_nonce
                && nonce.inbound_nonce + PENDING_INBOUND_NONCE_MAX_LEN >= new_inbound_nonce,
            LayerZeroError::InvalidNonce
        );

        // allow to re-verify at the same nonce and insert the new nonce if it doesn't already exist
        if let Err(index) = self.nonces.binary_search(&new_inbound_nonce) {
            self.nonces.insert(index, new_inbound_nonce);

            // update the inbound nonce on insert
            nonce.update_inbound_nonce(self);
        }
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct PayloadHash {
    pub hash: [u8; 32],
    pub bump: u8,
}