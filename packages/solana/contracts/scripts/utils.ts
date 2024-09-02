import { ENFORCED_OPTIONS_SEED, EVENT_SEED, LZ_RECEIVE_TYPES_SEED, OAPP_SEED, PEER_SEED, MESSAGE_LIB_SEED, SEND_LIBRARY_CONFIG_SEED, ENDPOINT_SEED, NONCE_SEED, ULN_SEED, SEND_CONFIG_SEED } from "@layerzerolabs/lz-solana-sdk-v2";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ENDPOINT_PROGRAM_ID, PEER_ADDRESS, SEND_LIB_PROGRAM_ID } from "./constants";

export function getOAppConfigPda(OAPP_PROGRAM_ID: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(OAPP_SEED, "utf8")],
        OAPP_PROGRAM_ID
    )[0];
}

export function getLzReceiveTypesPda(OAPP_PROGRAM_ID: PublicKey, oappConfigPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(LZ_RECEIVE_TYPES_SEED, "utf8"), oappConfigPda.toBuffer()],
        OAPP_PROGRAM_ID
    )[0];
}

export function getPeerPda(OAPP_PROGRAM_ID: PublicKey, oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);

    return PublicKey.findProgramAddressSync(
        [Buffer.from(PEER_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid],
        OAPP_PROGRAM_ID
    )[0];
}

export function getEventAuthorityPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(EVENT_SEED, "utf8")],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getOAppRegistryPda(oappConfigPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(OAPP_SEED, "utf8"), oappConfigPda.toBuffer()],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getEndorcedOptionsPda(OAPP_PROGRAM_ID: PublicKey, oappConfigPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(ENFORCED_OPTIONS_SEED, "utf8"), oappConfigPda.toBuffer()],
        OAPP_PROGRAM_ID
    )[0];
}

export function getSendLibConfigPda(): PublicKey{
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8"), SEND_LIB_PROGRAM_ID.toBuffer()],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getSendLibInfoPda(sendLibPda: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(MESSAGE_LIB_SEED, "utf8"), sendLibPda.toBuffer()],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getDefaultSendLibConfigPda(dstEid: number): PublicKey{
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_LIBRARY_CONFIG_SEED, "utf8"), bufferDstEid],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getSendConfigPda(oappConfigPda: PublicKey, dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_CONFIG_SEED, "utf8"), bufferDstEid, oappConfigPda.toBuffer()],
        SEND_LIB_PROGRAM_ID
    )[0];
}

export function getDefaultSendConfigPda(dstEid: number): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(SEND_CONFIG_SEED, "utf8"), bufferDstEid],
        SEND_LIB_PROGRAM_ID
    )[0];
}

export function getUlnEventAuthorityPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(EVENT_SEED, "utf8")],
        SEND_LIB_PROGRAM_ID
    )[0];
}

export function getEndpointSettingPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(ENDPOINT_SEED, "utf8")],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getNoncePda(oappConfigPda: PublicKey, dstEid: number, peer_address: Uint8Array): PublicKey {
    const bufferDstEid = Buffer.alloc(4);
    bufferDstEid.writeUInt32BE(dstEid);
    return PublicKey.findProgramAddressSync(
        [Buffer.from(NONCE_SEED, "utf8"), oappConfigPda.toBuffer(), bufferDstEid, peer_address],
        ENDPOINT_PROGRAM_ID
    )[0];
}

export function getUlnSettingPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(ULN_SEED, "utf8")],
        SEND_LIB_PROGRAM_ID
    )[0];
}


export function setAnchor(): [anchor.AnchorProvider, anchor.Wallet] {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const wallet = provider.wallet as anchor.Wallet;
    return [provider, wallet];
}
