import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import { oft } from "@layerzerolabs/oft-v2-solana-sdk";
const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 

async function transferAdmin() {
    const multisig = utils.getMultisig(ENV);
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);

    console.log("Set delegate and transfer admin...");
    const ixSetDelegate = await OftTools.createSetDelegateIx(
        wallet.publicKey,
        oappConfigPda,
        multisig,
        OAPP_PROGRAM_ID,
        constants.ENDPOINT_PROGRAM_ID
    )
    
    const transferAdminParams = {
        admin: multisig,
    };
    const ixTransferAdmin = await OAppProgram.methods.transferAdmin(transferAdminParams).accounts({
        admin: wallet.publicKey,
        oappConfig: oappConfigPda,
    }).instruction();
    const txSetDelegateAndAdmin = new Transaction().add(ixSetDelegate).add(ixTransferAdmin);
 
    const sigTransferAdmin = await sendAndConfirmTransaction(
        provider.connection,
        txSetDelegateAndAdmin,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    )
    console.log("sigTransferAdmin", sigTransferAdmin);
}

transferAdmin();