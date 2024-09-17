import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import * as utils from "./utils";
import * as constants from "./constants";
import OAppIdl from "../target/idl/solana_vault.json";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);

const [provider, wallet, rpc] = utils.setAnchor();

const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);


async function init() {
    const ixInitNonce = await OftTools.createInitNonceIx(
        wallet.publicKey,
        constants.DST_EID,
        oappConfigPda,
        constants.PEER_ADDRESS,
        constants.ENDPOINT_PROGRAM_ID
    );

    const txInitNonce = new Transaction().add(ixInitNonce);

    try {
        const sigInitNonce = await sendAndConfirmTransaction(
            provider.connection,
            txInitNonce,
            [wallet.payer],
            {
                commitment: "confirmed",
                preflightCommitment: "confirmed"
            }
        )
    
        console.log("Init Nonce transaction confirmed:", sigInitNonce);
    } catch (e) {
        console.log("Already Init Nonce");
    }

    const IxInitConfig = await OftTools.createInitConfigIx(
        wallet.publicKey,
        oappConfigPda,
        constants.DST_EID,
        constants.SEND_LIB_PROGRAM_ID,
        constants.ENDPOINT_PROGRAM_ID
    );

    const txInitConfig = new Transaction().add(IxInitConfig);

    try {
        const sigInitConfig = await sendAndConfirmTransaction(
            provider.connection,
            txInitConfig,
            [wallet.payer],
            {
                commitment: "confirmed",
                preflightCommitment: "confirmed"
            }
        )

        console.log("Init Config transaction confirmed:", sigInitConfig);
    } catch (e) {
        console.log("Already Init Config");
    }
    
}

init();