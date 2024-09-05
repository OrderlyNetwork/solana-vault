import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools, SetConfigType } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { setAnchor, getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, getSendLibConfigPda, getSendLibInfoPda, getSendLibPda, getDvnConfigPda } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID, RECEIVE_LIB_PROGRAM_ID, EXECUTOR_PROGRAM_ID, EXECUTOR_PDA } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);


const [provider, wallet, rpc] = setAnchor();


const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);
console.log("OApp Config PDA:", oappConfigPda.toBase58());

const sendLibConfigPda = getSendLibConfigPda(oappConfigPda, DST_EID);
console.log("Send Library Config PDA:", sendLibConfigPda.toBase58());

const sendLibPda = getSendLibPda();
console.log("Send Library PDA:", sendLibPda.toBase58());
const sendLibInfoPda = getSendLibInfoPda(sendLibPda);
console.log("Send Library Info PDA:", sendLibInfoPda.toBase58());

const dvnConfigPda = getDvnConfigPda();

async function setconfig() {
    await setSendConfig();
    await setReceiveConfig();
}

async function setSendConfig() {
    const txInitSendLib = new Transaction().add(
        await OftTools.createInitSendLibraryIx(
            wallet.publicKey,
            oappConfigPda,
            DST_EID,
        ),        
    );

    try {
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
    } catch (e) {
        console.log("Send Library already initialized");
    }
    

    const txSetSendLib = new Transaction().add(
        await OftTools.createSetSendLibraryIx(
            wallet.publicKey,
            oappConfigPda,
            SEND_LIB_PROGRAM_ID,
            DST_EID,
        ),
    );

    const sigSetSendLib = await sendAndConfirmTransaction(
        provider.connection,
        txSetSendLib,
        [wallet.payer],
    );

    console.log("Set Send Library transaction confirmed:", sigSetSendLib);
}

async function setReceiveConfig() {

    try{
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
    } catch (e) {
        console.log("Receive Library already initialized");
    }

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

// setconfig();

async function getConfig() {
    const config = await OftTools.getEndpointConfig(
        provider.connection,
        new PublicKey("5Lgo8UDHs9q76YZLtZpWMPFXzopTEqux4PLEJj5HG6Hs"),
        DST_EID,
    );

    console.log("Config:", config);
}

// getConfig();

// setULN();

async function setULN() {
    // Set the Executor config for the pathway.
        const setExecutorConfigTransaction = new Transaction().add(
            await OftTools.createSetConfigIx(
                provider.connection,
                wallet.publicKey,
                oappConfigPda,
                DST_EID,
                SetConfigType.EXECUTOR,
                {
                    executor: EXECUTOR_PDA,
                    maxMessageSize: 10000,
                },
            ),
        );

        const setExecutorConfigSignature = await sendAndConfirmTransaction(
            provider.connection,
            setExecutorConfigTransaction,
            [wallet.payer],
        );
        console.log(
            `✅ Set executor configuration for dstEid ${DST_EID}! View the transaction here: ${setExecutorConfigSignature}`,
        );

        // Set the Executor config for the pathway.
        const setSendUlnConfigTransaction = new Transaction().add(
            await OftTools.createSetConfigIx(
                provider.connection,
                wallet.publicKey,
                oappConfigPda,
                DST_EID,
                SetConfigType.SEND_ULN,
                {
                    confirmations: 10, // should be consistent with the target chain
                    requiredDvnCount: 1,
                    optionalDvnCount: 0,
                    optionalDvnThreshold: 0,
                    requiredDvns: [dvnConfigPda].sort(),
                    optionalDvns: [],
                },
            ),
        );

        const setSendUlnConfigSignature = await sendAndConfirmTransaction(
            provider.connection,
            setSendUlnConfigTransaction,
            [wallet.payer],
        );
        console.log(
            `✅ Set send uln configuration for dstEid ${DST_EID}! View the transaction here: ${setSendUlnConfigSignature}`,
        );

        // Set the Executor config for the pathway.
        const setReceiveUlnConfigTransaction = new Transaction().add(
            await OftTools.createSetConfigIx(
                provider.connection,
                wallet.publicKey,
                oappConfigPda,
                DST_EID,
                SetConfigType.RECEIVE_ULN,
                {
                    confirmations: 1, // should be consistent with the target chain
                    requiredDvnCount: 1,
                    optionalDvnCount: 0,
                    optionalDvnThreshold: 0,
                    requiredDvns: [dvnConfigPda].sort(),
                    optionalDvns: [],
                },
            ),
        );

        const setReceiveUlnConfigSignature = await sendAndConfirmTransaction(
            provider.connection,
            setReceiveUlnConfigTransaction,
            [wallet.payer],
        );
        console.log(
            `✅ Set receive uln configuration for dstEid ${DST_EID}! View the transaction here: ${setReceiveUlnConfigSignature}`,
        );
}