import { ENFORCED_OPTIONS_SEED, EVENT_SEED, LZ_RECEIVE_TYPES_SEED, OAPP_SEED, PEER_SEED, OftTools, getEndpointProgramId } from "@layerzerolabs/lz-solana-sdk-v2";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ENDPOINT_PROGRAM_ID } from "./constants";

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


export function setAnchor(): [anchor.AnchorProvider, anchor.Wallet] {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const wallet = provider.wallet as anchor.Wallet;
    return [provider, wallet];
}
