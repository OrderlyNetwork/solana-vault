pub mod instructions;
pub mod state;
pub mod errors;

use anchor_lang::prelude::*;
use instructions::*;
use state::*;
use errors::*;

declare_id!("C7m5cSdywrXKGRif5txcZkffRmsARtj1WssWfkdwKxMc");

pub const ENDPOINT_SEED: &[u8] = b"Endpoint";
pub const MESSAGE_LIB_SEED: &[u8] = b"MessageLib";
pub const SEND_LIBRARY_CONFIG_SEED: &[u8] = b"SendLibraryConfig";
pub const RECEIVE_LIBRARY_CONFIG_SEED: &[u8] = b"ReceiveLibraryConfig";
pub const NONCE_SEED: &[u8] = b"Nonce";
pub const PENDING_NONCE_SEED: &[u8] = b"PendingNonce";
pub const PAYLOAD_HASH_SEED: &[u8] = b"PayloadHash";
pub const COMPOSED_MESSAGE_HASH_SEED: &[u8] = b"ComposedMessageHash";
pub const OAPP_SEED: &[u8] = b"OApp";

pub const DEFAULT_MESSAGE_LIB: Pubkey = Pubkey::new_from_array([0u8; 32]);

#[program]
pub mod endpoint {
    use super::*;

    pub fn init_endpoint(mut ctx: Context<InitEndpoint>, params: InitEndpointParams) -> Result<()> {
        InitEndpoint::apply(&mut ctx, &params)
    }

    pub fn register_oapp(mut ctx: Context<RegisterOApp>, params: RegisterOAppParams) -> Result<()> {
        RegisterOApp::apply(&mut ctx, &params)
    }

    pub fn init_default_receive_library(
        mut ctx: Context<InitDefaultReceiveLibrary>,
        params: InitDefaultReceiveLibraryParams,
    ) -> Result<()> {
        InitDefaultReceiveLibrary::apply(&mut ctx, &params)
    }

    pub fn init_receive_library(
        mut ctx: Context<InitReceiveLibrary>,
        params: InitReceiveLibraryParams,
    ) -> Result<()> {
        InitReceiveLibrary::apply(&mut ctx, &params)
    }

    pub fn init_verify(mut ctx: Context<InitVerify>, params: InitVerifyParams) -> Result<()> {
        InitVerify::apply(&mut ctx, &params)
    }

    pub fn verify(mut ctx: Context<Verify>, params: VerifyParams) -> Result<()> {
        Verify::apply(&mut ctx, &params)
    }

    pub fn init_nonce(mut ctx: Context<InitNonce>, params: InitNonceParams) -> Result<()> {
        InitNonce::apply(&mut ctx, &params)
    }

    pub fn clear(mut ctx: Context<Clear>, params: ClearParams) -> Result<[u8; 32]> {
        Clear::apply(&mut ctx, &params)
    }
}