# Solana Vault for Orderly

This project is to set up Orderly's Vault on Solana blockchain. It is built on top of LayerZero's OApp/OFT codebase within the Anchor framework. And the Solana Vault is connected with Orderly chain through the LayerZero protocol.

## Deploy

### Prepare Keypair

Before deploying the Solana Vault program, you have to generate the keypair and sync it into the source code as the program ID.

```
solana-keygen new -o target/deploy/solana_vault-keypair.json
anchor keys sync
```

### Set Env

Edit the `Anchor.toml` file to set the proper cluster (`localnet`, `devnet`, or `mainnet`) and the wallet (keypair) for your needs.

```
[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"
```

#### Set Localnet

To set a local Solana cluster, please run the following command on your `home` directory:

```base
solana-test-validator --reset
```

If you want to test with fork of the devnet or mainnet, please run the following command:

```base
solana-test-validator --clone-upgradeable-program [PROGRAM_ID] -c [ACCOUNT] --url devnet --reset
```

You should clone many programs and its corresponding PDAs to your local environment. For example, the Endpoint program and its config PDAs.

Here is an example base on the predefined program ID (`EYJq9eU4GMRUriUJBgGoZ8YLQBXcWaciXuSsEXE7ieQS`), once you synced the key, many of the PDAs might be different.

```
solana-test-validator --clone-upgradeable-program 76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6 --clone-upgradeable-program 7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH --clone-upgradeable-program HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW --clone-upgradeable-program 6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn --clone-upgradeable-program 8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP -c 2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ -c 526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c 3hfYq9afjFbedp4GZk6n9ZefuCbhvgf4z4Jiyw2QEEPY -c 2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3 -c 4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb -c CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ -c AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c FFf52Jx9Biw3QUjcZ3nPYyuGy9bE8Dmzv1AJryjzJX6X -c 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU -c 8g3yNyoXr6N4c8eQapQ1jeX5oDYY2kgzvDx6Lb9qunhA -c BWp8HaYYhiNHekt3zgQhqoCrRftneGxxfgKmCZ6svHN -c BswrQQoPKAFojTuJutZcBMtigAgTghEH4M8ofn3EG2X2 -c BbGKfxuPwDmu58BjPpd7PMG69TqnZjSpKaLDMgf9E9Dr --url devnet --reset
```

### Deploy

To deploy the Vault program, run the following command:

```
anchor build
anchor deploy -p solana-vault
```

## Setup

The Solana Vault program consists of two parts:

1. The OApp part: Communicate with Orderly protocol
2. The Vault part: Safeguard the user's assets

### OApp Config

To set up the OApp part, please run the following command:

```bash
anchor run setup_oapp
anchor run init_oapp
anchor run setconfig_oapp
```

To set up the Vault part, please run the following command:

```bash
anchor run setup_vault
anchor run set_broker
anchor run set_token
```

After running the above commands, you will get the OApp and Vault PDA accounts, to print them out, please run:

```bash
anchor run print_pda
```

## Deposit

For deposit intruction, we have to create a lookup table first.

```bash
anchor run lookup_table
```

To deposit the assets (currently only USDC is supported) into the Vault, please run the following command:

```bash
anchor run deposit_vault
```

The deposit process is handled by the `deposit` instruction in the `solana-vault` program. The related accounts are:

```
#[derive(Accounts)]
#[instruction(deposit_params: DepositParams, oapp_params: OAppSendParams)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = deposit_token,
        associated_token::authority = user
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [VAULT_AUTHORITY_SEED],
        bump = vault_authority.bump,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = deposit_token,
        associated_token::authority = vault_authority
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,

    #[account()]
    pub deposit_token: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [
            PEER_SEED,
            &oapp_config.key().to_bytes(),
            &oapp_params.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Box<Account<'info, Peer>>,

    #[account(
        seeds = [
            ENFORCED_OPTIONS_SEED,
            &oapp_config.key().to_bytes(),
            &oapp_params.dst_eid.to_be_bytes()
        ],
        bump = enforced_options.bump
    )]
    pub enforced_options: Box<Account<'info, EnforcedOptions>>,

    #[account(
        seeds = [OAPP_SEED],
        bump = oapp_config.bump
    )]
    pub oapp_config: Box<Account<'info, OAppConfig>>,

    #[account(
        seeds = [BROKER_SEED, deposit_params.broker_hash.as_ref()],
        bump = allowed_broker.bump,
        constraint = allowed_broker.allowed == true @ VaultError::BrokerNotAllowed
    )]
    pub allowed_broker: Box<Account<'info, AllowedBroker>>,

    #[account(
        seeds = [TOKEN_SEED, deposit_params.token_hash.as_ref()],
        bump = allowed_token.bump,
        constraint = allowed_token.allowed == true @ VaultError::TokenNotAllowed
    )]
    pub allowed_token: Box<Account<'info, AllowedToken>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
```

The parameters for the `deposit` instruction are:

```
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    pub account_id: [u8; 32],
    pub broker_hash: [u8; 32],
    pub token_hash: [u8; 32],
    pub user_address: [u8; 32],
    pub src_chain_id: u128,
    pub token_amount: u64,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct OAppSendParams {
    pub dst_eid: u32,
    pub native_fee: u64,
    pub lz_token_fee: u64,
}
```

solana-test-validator --clone-upgradeable-program 76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6 --clone-upgradeable-program 7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH --clone-upgradeable-program HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW --clone-upgradeable-program 6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn --clone-upgradeable-program 8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP -c 2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ -c 526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c 3hfYq9afjFbedp4GZk6n9ZefuCbhvgf4z4Jiyw2QEEPY -c 2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3 -c 4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb -c CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ -c AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK -c Fwp955krKJXiyYRY1Ex2VFcrMJD2kLBp8X7mxakRffPe -c FFf52Jx9Biw3QUjcZ3nPYyuGy9bE8Dmzv1AJryjzJX6X -c 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU -c 8g3yNyoXr6N4c8eQapQ1jeX5oDYY2kgzvDx6Lb9qunhA --url devnet --reset
