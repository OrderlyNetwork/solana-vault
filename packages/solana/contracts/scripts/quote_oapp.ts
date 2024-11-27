import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as utils from "./utils";
import * as constants from "./constants";
import { Buffer } from "buffer";

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 
const DST_EID = utils.getDstEid(ENV);
const PEER_ADDRESS = utils.getPeerAddress(ENV);

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
    const lookupTableList = utils.printPda(OAPP_PROGRAM_ID, wallet, rpc, ENV);
    
    const oappConfigPda = lookupTableList[0];
    const peerPda = lookupTableList[2];
    const enforcedOptionsPda = lookupTableList[5];
    const endpointPda = utils.getEndpointSettingPda(constants.ENDPOINT_PROGRAM_ID)
    const oappPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const oappRegistryPda = utils.getOAppRegistryPda(oappPda)
    const sendLibraryConfigPda = utils.getSendLibConfigPda(oappPda, DST_EID)
    const defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(DST_EID)
    const messageLibPda = utils.getMessageLibPda(constants.SEND_LIB_PROGRAM_ID)
    const messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
    const efOptionsPda = utils.getEnforcedOptionsPda(OAPP_PROGRAM_ID, oappPda, DST_EID)    
    const eventAuthorityPda = utils.getEventAuthorityPda()
    const noncePda = utils.getNoncePda(oappPda, DST_EID, PEER_ADDRESS)
    const pendingInboundNoncePda = utils.getPendingInboundNoncePda(oappPda, DST_EID, PEER_ADDRESS)

    // Create a sample deposit message
    const depositMsg = Buffer.alloc(32*7); // Adjust size as needed
    // depositMsg.writeBigUInt64LE(BigInt(1000000), 0); // Example amount
    // wallet.publicKey.toBuffer().copy(depositMsg, 8); // Copy recipient address

    // Encode the LzMessage
    const lzMessage = encodeLzMessage({
        msgType: MsgType.Deposit,
        payload: depositMsg,
    });

    console.log("Setting up Vault...");
    const senderAddress = wallet.publicKey;
    // const receiverAddress = new PublicKey("9aFZUMoeVRvUnaE34RsHxpcJXvFMPPSWrG3QDNm6Sskf");

    const receiverAddress = senderAddress;
    const usdc = utils.getUSDCAddress(rpc);
    const userUSDCAccount = utils.getUSDCAccount(usdc, senderAddress);

    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    console.log("🔑 Vault Deposit Authority PDA:", vaultAuthorityPda.toBase58());

    const vaultUSDCAccount = await utils.getUSDCAccount(usdc, vaultAuthorityPda);
    console.log("💶 Vault USDCAccount", vaultUSDCAccount.toBase58());

    const brokerId = "woofi_pro";
    const tokenSymbol = "USDC";
    const brokerHash = utils.getBrokerHash(brokerId);
    console.log("Broker Hash:", brokerHash);
    const codedBrokerHash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'));
    const tokenHash = utils.getTokenHash(tokenSymbol);
    console.log("Token Hash:", tokenHash);

    const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    const solAccountId = utils.getSolAccountId(receiverAddress, brokerId); 
    console.log("Sol Account Id:", solAccountId);
    const codedAccountId = Array.from(Buffer.from(solAccountId.slice(2), 'hex'));
    

    
    const depositParams = {
        accountId:  codedAccountId,
        brokerHash: codedBrokerHash,
        tokenHash:  codedTokenHash,
        userAddress: Array.from(receiverAddress.toBuffer()),
        tokenAmount: new anchor.BN(1_000_000_000),
    };

    // print utils.getUlnSettingPda()
    console.log("Uln Setting PDA:", utils.getUlnSettingPda());
    const quoteRemainingAccounts =  utils.getQuoteRemainingAccounts(OAPP_PROGRAM_ID, ENV);
    try {
        const { lzTokenFee, nativeFee } = await OAppProgram.methods
            .oappQuote(depositParams)
            .accounts({
                oappConfig: oappConfigPda,
                peer: peerPda,
                enforcedOptions: enforcedOptionsPda,
                vaultAuthority: vaultAuthorityPda,
            })
            .remainingAccounts(quoteRemainingAccounts)
            .view();

        console.log("LayerZero cross-chain fee quote:");
        console.log("Native fee:", nativeFee.toString());
        console.log("LZ token fee:", lzTokenFee.toString());
    } catch (error) {
        console.error("Error quoting LayerZero fee:", error);
    }
}

quoteLayerZeroFee();
