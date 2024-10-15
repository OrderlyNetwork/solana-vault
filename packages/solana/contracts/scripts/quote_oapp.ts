import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as utils from "./utils";
import * as constants from "./constants";
import { Buffer } from "buffer";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";

const [provider, wallet, rpc] = utils.setAnchor();

const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;


// Enum for MsgType
enum MsgType {
    Deposit = 0,
    // Add other message types if needed
}

// LzMessage structure
interface LzMessage {
    msgType: MsgType;
    payload: Buffer;
}

interface VaultDepositParams {
    accountId: Buffer;
    brokerHash: Buffer;
    userAddress: Buffer;
    tokenHash: Buffer;
    srcChainId: bigint;
    tokenAmount: bigint;
    srcChainDepositNonce: bigint;
}

// Function to encode VaultDepositParams
function encodeVaultDepositParams(params: VaultDepositParams): Buffer {
    const buf = Buffer.alloc(32 * 7); // 7 fields, each 32 bytes
    let offset = 0;

    params.accountId.copy(buf, offset);
    offset += 32;
    params.brokerHash.copy(buf, offset);
    offset += 32;
    params.userAddress.copy(buf, offset);
    offset += 32;
    params.tokenHash.copy(buf, offset);
    offset += 32;
    buf.writeBigUInt64BE(params.srcChainId, offset + 24);
    offset += 32;
    buf.writeBigUInt64BE(params.tokenAmount, offset + 24);
    offset += 32;
    buf.writeBigUInt64BE(params.srcChainDepositNonce, offset + 24);

    return buf;
}

// Function to encode LzMessage
function encodeLzMessage(message: LzMessage): Buffer {
    const msgTypeBuffer = Buffer.alloc(1);
    msgTypeBuffer.writeUInt8(message.msgType);
    return Buffer.concat([msgTypeBuffer, message.payload]);
}

async function quoteLayerZeroFee() {
    console.log("Quoting LayerZero cross-chain fee...");
    const lookupTableAddresses = utils.printPda(OAPP_PROGRAM_ID, wallet, rpc);
    
    const oappConfigPda = lookupTableAddresses[0];
    const peerPda = lookupTableAddresses[2];
    const enforcedOptionsPda = lookupTableAddresses[5];
    const endpointPda = utils.getEndpointSettingPda(constants.ENDPOINT_PROGRAM_ID)
    const oappPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const oappRegistryPda = utils.getOAppRegistryPda(oappPda)
    const sendLibraryConfigPda = utils.getSendLibConfigPda(oappPda, constants.DST_EID)
    const defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(constants.DST_EID)
    const messageLibPda = utils.getMessageLibPda(constants.SEND_LIB_PROGRAM_ID)
    const messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
    const efOptionsPda = utils.getEnforcedOptionsPda(OAPP_PROGRAM_ID, oappPda, constants.DST_EID)    
    const eventAuthorityPda = utils.getEventAuthorityPda()
    const noncePda = utils.getNoncePda(oappPda, constants.DST_EID, constants.PEER_ADDRESS)
    const pendingInboundNoncePda = utils.getPendingInboundNoncePda(oappPda, constants.DST_EID, constants.PEER_ADDRESS)

    // Create a sample deposit message
    const depositMsg = Buffer.alloc(32*7); // Adjust size as needed
    // depositMsg.writeBigUInt64LE(BigInt(1000000), 0); // Example amount
    // wallet.publicKey.toBuffer().copy(depositMsg, 8); // Copy recipient address

    // Encode the LzMessage
    const lzMessage = encodeLzMessage({
        msgType: MsgType.Deposit,
        payload: depositMsg,
    });

    const quoteParams = {
        dstEid: constants.DST_EID,
        to: Array.from(constants.PEER_ADDRESS),
        options: Buffer.from([]),
        message: lzMessage,
        payInLzToken: false
    };

    // print utils.getUlnSettingPda()
    console.log("Uln Setting PDA:", utils.getUlnSettingPda());

    try {
        const { lzTokenFee, nativeFee } = await OAppProgram.methods
            .oappQuote(quoteParams)
            .accounts({
                oappConfig: oappConfigPda,
                peer: peerPda,
                enforcedOptions: enforcedOptionsPda
            })
            .remainingAccounts([
                {
                    pubkey: constants.ENDPOINT_PROGRAM_ID,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: constants.SEND_LIB_PROGRAM_ID,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: sendLibraryConfigPda, // send_library_config
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: defaultSendLibraryConfigPda, // default_send_library_config
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: messageLibInfoPda, // send_library_info
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: endpointPda, // endpoint settings
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: noncePda, // nonce
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: messageLibPda,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: utils.getSendConfigPda(oappConfigPda, constants.DST_EID),
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: utils.getDefaultSendConfigPda(constants.DST_EID),
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: constants.EXECUTOR_PROGRAM_ID,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: utils.getExecutorConfigPda(),
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: constants.PRICE_FEED_PROGRAM_ID,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: utils.getPriceFeedPda(),
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: constants.DVN_PROGRAM_ID,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: utils.getDvnConfigPda(),
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: constants.PRICE_FEED_PROGRAM_ID,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: utils.getPriceFeedPda(),
                    isWritable: false,
                    isSigner: false,
                },
            ])
            .view();

        console.log("LayerZero cross-chain fee quote:");
        console.log("Native fee:", nativeFee.toString());
        console.log("LZ token fee:", lzTokenFee.toString());
    } catch (error) {
        console.error("Error quoting LayerZero fee:", error);
    }
}

quoteLayerZeroFee();
