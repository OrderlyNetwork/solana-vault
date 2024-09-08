import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { setAnchor, getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, getSendLibConfigPda } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();

const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);


async function init() {
    const ixInitNonce = await OftTools.createInitNonceIx(
        wallet.publicKey,
        DST_EID,
        oappConfigPda,
        PEER_ADDRESS,
        ENDPOINT_PROGRAM_ID
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
        DST_EID,
        SEND_LIB_PROGRAM_ID,
        ENDPOINT_PROGRAM_ID
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