import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(); 
const ENV = utils.getEnv(OAPP_PROGRAM_ID);

async function transferAdmin() {
    const multisig = utils.getMultisig(ENV);
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const transferAdminParams = {
        admin: multisig,
    };
    const ixTransferAdmin = await OAppProgram.methods.transferAdmin(transferAdminParams).accounts({
        admin: wallet.publicKey,
        oappConfig: oappConfigPda,
    }).instruction();

    const txTransferAdmin = new Transaction().add(ixTransferAdmin);
    const sigTransferAdmin = await sendAndConfirmTransaction(
        provider.connection,
        txTransferAdmin,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    )
    console.log("sigTransferAdmin", sigTransferAdmin);
}

transferAdmin();