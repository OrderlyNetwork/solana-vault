use anchor_lang::prelude::*;

// use crate::oapp_instr::cpi::accounts::OAppSend;
use crate::oapp_instr::oapp_send::OAppSend;
use crate::oapp_instr::oapp_send::OAppSendParams;

#[derive(Accounts)]
#[instruction(params: OAppSendParams)]
pub struct CallOapp<'info> {
    signer: Signer<'info>,
}

impl<'info> CallOapp<'info> {
    pub fn apply(
        ctx: &mut Context<'_, '_, '_, 'info, CallOapp<'info>>,
        params: &OAppSendParams,
    ) -> Result<()> {
        msg!("Calling OApp with params.message: {:?}", params.message);

        // let orderly_oapp_send_accounts = OAppSend {
        //     peer: ctx.remaining_accounts[2].to_account_info(),
        //     enforced_options: ctx.remaining_accounts[3].to_account_info(),
        //     oapp_config: ctx.remaining_accounts[4].to_account_info(),
        //     event_authority: ctx.remaining_accounts[1].to_account_info(),
        //     program: ctx.remaining_accounts[0].to_account_info(),
        // };

        // let remaining_accounts = ctx.remaining_accounts[..].to_vec();
        // msg!("Remaining accounts: {:?}", remaining_accounts);
        // msg!("length of remaining accounts: {:?}", remaining_accounts.len());
        // let orderly_oapp_ctx = CpiContext::new(
        //     ctx.remaining_accounts[0].to_account_info(),
        //     orderly_oapp_send_accounts,
        // );
        // orderly_oapp_ctx.remaining_accounts = ctx.remaining_accounts[5..].to_vec();

        // orderly_oapp_interface::cpi::oapp_send(
        //     orderly_oapp_ctx.with_remaining_accounts(ctx.remaining_accounts[5..].to_vec()),
        //     params.clone(),
        // )?;
        Ok(())
    }
}
