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

Edit the `Anchor.toml` file to set the proper clustor (`localnet`, `devnet`, `testnet`, or `mainnet`) and the wallet (keypair) for your needs.

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
anchor run setconfig_oapp
anchor run init_oapp
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

To deposit the assets (currently only USDC is supported) into the Vault, please run the following command:

```bash
anchor run deposit_vault
```
