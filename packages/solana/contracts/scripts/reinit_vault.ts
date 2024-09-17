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

    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);

    const reinitVaultParams = {
        owner: wallet.publicKey,
        dstEid: constants.DST_EID,
        solChainId: new anchor.BN(constants.SOL_CHAIN_ID),
        orderDelivery: true,
        inboundNonce: new anchor.BN(74),   // to check the latest nonce, need to check on lzscan
        depositNonce: new anchor.BN(78),   //
        
    };

    const ixReinitVault = await OAppProgram.methods.reinitVault(reinitVaultParams).accounts({
        admin: wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
        oappConfig: oappConfigPda
    }).instruction();

    const txReinitVault = new Transaction().add(ixReinitVault);
    const sigReinitVault = await sendAndConfirmTransaction(provider.connection, txReinitVault, [wallet.payer]);
    console.log("sigreinitVault", sigReinitVault);


}

reinit();