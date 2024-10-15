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

## Quote OApp fee

1. Make sure the oapp program id is set correctly in source code and Anchor.toml

2. Because the definition of `MessagingFee` is not included in the IDL, you can copy the files in `interface/` to overwrite the generated files in `target/types/` after you build the project.

3. Run the script

```bash
anchor run quote_deposit --provider.cluster devnet
```

4. example output

```
LayerZero cross-chain fee quote:
Native fee: 16768
LZ token fee: 0
```
