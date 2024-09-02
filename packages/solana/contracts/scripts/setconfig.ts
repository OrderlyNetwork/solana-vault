import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { setAnchor, getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, getSendLibConfigPda } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID, RECEIVE_LIB_PROGRAM_ID } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);

const [provider, wallet] = setAnchor();

const sendLibConfigPda = getSendLibConfigPda();
const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);
console.log("OApp Config PDA:", oappConfigPda.toBase58());

async function setconfig() {
    // await setSendConfig();
    await setReceiveConfig();
}

async function setSendConfig() {
    const txInitSendLib = new Transaction().add(
        await OftTools.createInitSendLibraryIx(
            wallet.publicKey,
            oappConfigPda,
            DST_EID,
            ENDPOINT_PROGRAM_ID
        ),        
    );

    const sigInitSendLib = await sendAndConfirmTransaction(
        provider.connection,
        txInitSendLib,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    );

    console.log("Init Send Library transaction confirmed:", sigInitSendLib);

    const txSetSendLib = new Transaction().add(
        await OftTools.createSetSendLibraryIx(
            wallet.publicKey,
            oappConfigPda,
            SEND_LIB_PROGRAM_ID,
            DST_EID,
            ENDPOINT_PROGRAM_ID
        ),
    );

    const sigSetSendLib = await sendAndConfirmTransaction(
        provider.connection,
        txSetSendLib,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    );

    console.log("Set Send Library transaction confirmed:", sigSetSendLib);
}

async function setReceiveConfig() {
    const txInitReceiveLib = new Transaction().add(
        await OftTools.createInitReceiveLibraryIx(
            wallet.publicKey,
            oappConfigPda,
            DST_EID,
            ENDPOINT_PROGRAM_ID
        ),
    );

    const sigInitReceiveLib = await sendAndConfirmTransaction(
        provider.connection,
        txInitReceiveLib,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    );

    console.log("Init Receive Library transaction confirmed:", sigInitReceiveLib);

    const txSetReceiveLib = new Transaction().add(
        await OftTools.createSetReceiveLibraryIx(
            wallet.publicKey,
            oappConfigPda,
            RECEIVE_LIB_PROGRAM_ID,
            DST_EID,
            BigInt(0),
            ENDPOINT_PROGRAM_ID
        ),
    );

    const sigSetReceiveLib = await sendAndConfirmTransaction(
        provider.connection,
        txSetReceiveLib,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    );

    console.log("Set Receive Library transaction confirmed:", sigSetReceiveLib);
}

setconfig();