import { PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { OftTools, SetConfigType } from "@layerzerolabs/lz-solana-sdk-v2";
import * as utils from "./utils";
import * as constants from "./constants";
import OAppIdl from "../target/idl/solana_vault.json";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);


const [provider, wallet, rpc] = utils.setAnchor();


const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
console.log("OApp Config PDA:", oappConfigPda.toBase58());

const sendLibConfigPda = utils.getSendLibConfigPda(oappConfigPda, constants.DST_EID);
console.log("Send Library Config PDA:", sendLibConfigPda.toBase58());

const sendLibPda = utils.getSendLibPda();
console.log("Send Library PDA:", sendLibPda.toBase58());
const sendLibInfoPda = utils.getSendLibInfoPda(sendLibPda);
console.log("Send Library Info PDA:", sendLibInfoPda.toBase58());

const dvnConfigPda = utils.getDvnConfigPda();

async function setconfig() {
    await setSendConfig();
    await setReceiveConfig();
    await setULN();
}

async function setSendConfig() {
    const txInitSendLib = new Transaction().add(
        await OftTools.createInitSendLibraryIx(
            wallet.publicKey,
            oappConfigPda,
            constants.DST_EID,
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
            constants.SEND_LIB_PROGRAM_ID,
            constants.DST_EID,
        ),
    );

    try {
        const sigSetSendLib = await sendAndConfirmTransaction(
            provider.connection,
            txSetSendLib,
            [wallet.payer],
        );
    
        console.log("Set Send Library transaction confirmed:", sigSetSendLib);
    } catch (e) {
        console.log("Send Library already set");
    }
}

async function setReceiveConfig() {

    try{
        const txInitReceiveLib = new Transaction().add(
            await OftTools.createInitReceiveLibraryIx(
                wallet.publicKey,
                oappConfigPda,
                constants.DST_EID,
                constants.ENDPOINT_PROGRAM_ID
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
            constants.RECEIVE_LIB_PROGRAM_ID,
            constants.DST_EID,
            BigInt(0),
            constants.ENDPOINT_PROGRAM_ID
        ),
    );

    try {
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
    } catch (e) {
        console.log("Receive Library already set");
    }
}

setconfig();

async function getConfig() {
    const config = await OftTools.getEndpointConfig(
        provider.connection,
        new PublicKey("5Lgo8UDHs9q76YZLtZpWMPFXzopTEqux4PLEJj5HG6Hs"),
        constants.DST_EID,
    );

    console.log("Config:", config);
}

async function setULN() {
    // Set the Executor config for the pathway.
        const setExecutorConfigTransaction = new Transaction().add(
            await OftTools.createSetConfigIx(
                provider.connection,
                wallet.publicKey,
                oappConfigPda,
                constants.DST_EID,
                SetConfigType.EXECUTOR,
                {
                    executor: constants.EXECUTOR_PDA,
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
            `✅ Set executor configuration for dstEid ${constants.DST_EID}! View the transaction here: ${setExecutorConfigSignature}`,
        );

        // Set the Executor config for the pathway.
        const setSendUlnConfigTransaction = new Transaction().add(
            await OftTools.createSetConfigIx(
                provider.connection,
                wallet.publicKey,
                oappConfigPda,
                constants.DST_EID,
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
            `✅ Set send uln configuration for dstEid ${constants.DST_EID}! View the transaction here: ${setSendUlnConfigSignature}`,
        );

        // Set the Executor config for the pathway.
        const setReceiveUlnConfigTransaction = new Transaction().add(
            await OftTools.createSetConfigIx(
                provider.connection,
                wallet.publicKey,
                oappConfigPda,
                constants.DST_EID,
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
            `✅ Set receive uln configuration for dstEid ${constants.DST_EID}! View the transaction here: ${setReceiveUlnConfigSignature}`,
        );
}