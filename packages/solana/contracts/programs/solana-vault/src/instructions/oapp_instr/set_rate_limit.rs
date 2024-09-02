use crate::*;

#[derive(Accounts)]
#[instruction(params: SetRateLimitParams)]
pub struct SetRateLimit<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [PEER_SEED, &oapp_config.key().to_bytes(), &params.dst_eid.to_be_bytes()],
        bump
    )]
    pub peer: Account<'info, Peer>,
    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump,
        has_one = admin @OAppError::Unauthorized
    )]
    pub oapp_config: Account<'info, OAppConfig>,
}

impl SetRateLimit<'_> {
    pub fn apply(ctx: &mut Context<SetRateLimit>, params: &SetRateLimitParams) -> Result<()> {
        if !params.enabled {
            ctx.accounts.peer.rate_limiter = None;
            return Ok(());
        }

        let mut rate_limiter = ctx.accounts.peer.rate_limiter.clone().unwrap_or_default();

        if let Some(capacity) = params.capacity {
            rate_limiter.set_capacity(capacity)?;
        }
        if let Some(refill_rate) = params.refill_per_second {
            rate_limiter.set_rate(refill_rate)?;
        }
        ctx.accounts.peer.rate_limiter = Some(rate_limiter);
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetRateLimitParams {
    pub dst_eid: u32,
    pub refill_per_second: Option<u64>,
    pub capacity: Option<u64>,
    pub enabled: bool,
}
