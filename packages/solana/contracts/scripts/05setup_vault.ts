import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import {
    createMint,
    createAccount,
    mintTo,
    getMint,
    getOrCreateAssociatedTokenAccount,
  } from "@solana/spl-token";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor, getVaultDepositAuthorityPda, createAndSendV0Tx, createAndSendV0TxWithTable, getBrokerHash, getTokenHash, getSolAccountId, getUSDCAccount, mintUSDC } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID, TREASURY_PROGRAM_ID,EXECUTOR_PROGRAM_ID, DVN_PROGRAM_ID, PRICE_FEED_PROGRAM_ID } from "./constants";
import * as utils from "./utils";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();

async function setup() {
    console.log("Setting up Vault...");
    const usdc = await utils.getUSDCAddress(provider, wallet, rpc);
    const userUSDCAccount = await utils.getUSDCAccount(provider, wallet, usdc, wallet.publicKey);
    console.log("User USDCAccount", userUSDCAccount.toBase58());

    
    const amountToMint = 5000;
    await utils.mintUSDC(provider, wallet, usdc, userUSDCAccount, amountToMint);

    const vaultDepositAuthorityPda = getVaultDepositAuthorityPda(OAPP_PROGRAM_ID, usdc);
    console.log("Vault Deposit Authority PDA:", vaultDepositAuthorityPda.toBase58());

    const vaultUSDCAccount = await utils.getUSDCAccount(provider, wallet, usdc, vaultDepositAuthorityPda);
    console.log("Vault USDCAccount", vaultUSDCAccount.toBase58());

    const userInfoPda = PublicKey.findProgramAddressSync(
        [wallet.publicKey.toBuffer()],
        OAPP_PROGRAM_ID
    )[0];

    const tableAddress = [usdc, vaultDepositAuthorityPda, vaultUSDCAccount, userInfoPda]

    const ixInitVault = await OAppProgram.methods.initVault().accounts({
        depositToken: usdc,
        vaultDepositAuthority: vaultDepositAuthorityPda,
        user: wallet.publicKey,

    }).instruction();

    console.log("Init Vault:");
    try {
        await createAndSendV0TxWithTable([ixInitVault], provider, wallet, tableAddress);
    } catch (e) {
        console.log("Vault already initialized");
    }
}

setup();