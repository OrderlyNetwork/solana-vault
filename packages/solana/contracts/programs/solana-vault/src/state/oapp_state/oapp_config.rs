use crate::*;
use oapp::endpoint::{instructions::RegisterOAppParams, ID as ENDPOINT_ID};

#[account]
#[derive(InitSpace)]
pub struct OAppConfig {
    pub endpoint_program: Pubkey,
    pub bump: u8,
    // mutable
    pub admin: Pubkey,
}

impl OAppConfig {
    // todo: optimize
    pub fn init(
        &mut self,
        endpoint_program: Option<Pubkey>,
        admin: Pubkey,
        accounts: &[AccountInfo],
        oapp_signer: Pubkey,
    ) -> Result<()> {
        self.admin = admin;
        self.endpoint_program = if let Some(endpoint_program) = endpoint_program {
            endpoint_program
        } else {
            ENDPOINT_ID
        };

        // register oapp
        oapp::endpoint_cpi::register_oapp(
            self.endpoint_program,
            oapp_signer,
            accounts,
            &[OAPP_SEED, &[self.bump]],
            RegisterOAppParams {
                delegate: self.admin,
            },
        )
    }
}

#[account]
#[derive(InitSpace)]
pub struct OAppLzReceiveTypesAccounts {
    pub oapp_config: Pubkey,
    pub account_list: Pubkey, // point to the AccountList pda, should be updated if a new AccountList applied
}

#[account]
#[derive(InitSpace)]
pub struct AccountList {
    pub bump: u8,
    pub usdc_pda: Pubkey,
    pub usdc_mint: Pubkey,
    pub woofi_pro_pda: Pubkey,
    // can add more pda accounts here in the future with different seeds
}
