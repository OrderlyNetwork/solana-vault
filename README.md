# Solana Vault for Orderly Network

For more information, please go to the README file under the `packages/solana/contracts` directory.

## Prepare ProgramId

Create programId keypair files if not existed

```
cd packages/solana/contracts

solana-keygen new -o target/deploy/solana_vault-keypair.json

anchor keys sync
```

## Build

```bash
yarn && yarn build
```
