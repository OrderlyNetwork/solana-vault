import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import * as utils from "./utils";
import * as constants from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = utils.setAnchor();



async function reinit() {

    const vaultOwnerPda = utils.getVaultOwnerPda(OAPP_PROGRAM_ID);
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);

    const reinitVaultParams = {
        owner: wallet.publicKey,
        dstEid: constants.DST_EID,
        orderDelivery: true,
        inboundNonce: new anchor.BN(72),   // to check the latest nonce, need to check on lzscan
        depositNonce: new anchor.BN(73),
        
    };

    const ixReinitVault = await OAppProgram.methods.reinitVault(reinitVaultParams).accounts({
        payer: wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
    }).instruction();

    const txReinitVault = new Transaction().add(ixReinitVault);
    const sigReinitVault = await sendAndConfirmTransaction(provider.connection, txReinitVault, [wallet.payer]);
    console.log("sigreinitVault", sigReinitVault);


}

reinit();