import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";

import * as utils from "./utils";
import * as constants from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 

const DST_EID = utils.getDstEid(ENV);
const SOL_CHAIN_ID = utils.getSolChainId(ENV);

async function setup() {
    const multisig = utils.getMultisig(ENV);
    const useMultisig = false;
    console.log("Setting up Vault...");
    const usdc = await utils.getUSDCAddress(rpc);
    const userUSDCAccount = await utils.getUSDCAccount(usdc, wallet.publicKey);
    console.log("User USDCAccount", userUSDCAccount.toBase58());
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    console.log("Vault Deposit Authority PDA:", vaultAuthorityPda.toBase58());

    const vaultUSDCAccount = await utils.getUSDCAccount(usdc, vaultAuthorityPda);
    console.log("Vault USDCAccount", vaultUSDCAccount.toBase58());
    
    let vaultAuthorityPdaData, setVaultParams
    try {
        vaultAuthorityPdaData = await OAppProgram.account.vaultAuthority.fetch(vaultAuthorityPda);

        console.log("Vault Authority PDA: ", vaultAuthorityPda.toBase58());
        console.log("   - vault owner: ", new PublicKey(vaultAuthorityPdaData.owner).toBase58());
        console.log("   - sol chain id: ", Number(vaultAuthorityPdaData.solChainId));
        console.log("   - dst eid: ", Number(vaultAuthorityPdaData.dstEid));
        console.log("   - deposit nonce: ", Number(vaultAuthorityPdaData.depositNonce));
        console.log("   - order delivery: ", vaultAuthorityPdaData.orderDelivery);
        console.log("   - inbound nonce: ", Number(vaultAuthorityPdaData.inboundNonce));
        
       setVaultParams = {
            owner: useMultisig? multisig : wallet.publicKey,   // wallet.publicKey
            depositNonce: new anchor.BN(vaultAuthorityPdaData.depositNonce),
            orderDelivery: true,
            inboundNonce: new anchor.BN(vaultAuthorityPdaData.inboundNonce),
            dstEid: DST_EID,
            solChainId: new anchor.BN(SOL_CHAIN_ID)
        } 
    }catch(e) {
        console.log("Vault Authority PDA not found and should initialize it");
        setVaultParams = {
            owner: wallet.publicKey,
            depositNonce: new anchor.BN(0),
            orderDelivery: true,
            inboundNonce: new anchor.BN(0),
            dstEid: DST_EID,
            solChainId: new anchor.BN(SOL_CHAIN_ID)
        }
    }
    
    const setVaultAccounts = {
        admin: useMultisig ? multisig : wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
        oappConfig: utils.getOAppConfigPda(OAPP_PROGRAM_ID),
    }

    const ixSetVault = await OAppProgram.methods.setVault(setVaultParams).accounts(setVaultAccounts).instruction();
    
    const txSetVault = new Transaction().add(ixSetVault);

    if (useMultisig) {
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetVault);
        console.log("txBase58 for set vault:\n", txBase58);
    } else {
        console.log("Set Vault:");
        const sigSetVault = await utils.createAndSendV0Tx([ixSetVault], provider, wallet);
        // console.log("sigSetVault", sigSetVault);
       
    }
}

setup();