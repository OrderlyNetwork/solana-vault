import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();

const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);
console.log("OApp Config PDA:", oappConfigPda.toBase58());

const lzReceiveTypesPda = getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
console.log("LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

const peerPda = getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
console.log("Peer PDA:", peerPda.toBase58());

const eventAuthorityPda = getEventAuthorityPda();
console.log("Event Authority PDA:", eventAuthorityPda.toBase58());

const oappRegistryPda = getOAppRegistryPda(oappConfigPda);
console.log("OApp Registry PDA:", oappRegistryPda.toBase58());

async function setup() {
    console.log("Setting up OApp...");


    const ixInitOapp = await OAppProgram.methods.initOapp({
        admin: wallet.publicKey,
        endpointProgram: ENDPOINT_PROGRAM_ID
    }).accounts({
        payer: wallet.publicKey,
        oappConfig: oappConfigPda,
        lzReceiveTypesAccounts: lzReceiveTypesPda,
        systemProgram: SystemProgram.programId
    }).remainingAccounts(
        [
            {
                isSigner: false,
                isWritable: false,
                pubkey: ENDPOINT_PROGRAM_ID,
            },
            {
                isSigner: true,
                isWritable: true,
                pubkey: wallet.publicKey, 
            },
            {
                isSigner: false,
                isWritable: false,
                pubkey: oappConfigPda, 
            },
            {
                isSigner: false,
                isWritable: true,
                pubkey: oappRegistryPda
            },
            {
                isSigner: false,
                isWritable: false,
                pubkey: SystemProgram.programId 
            },
            {
                isSigner: false,
                isWritable: true,
                pubkey: eventAuthorityPda
            },
            {
                isSigner: false,
                isWritable: false,
                pubkey: ENDPOINT_PROGRAM_ID
            },
        ]
    ).instruction();
    
    const txInitOapp = new Transaction().add(ixInitOapp);
    const sigInitOapp = await provider.sendAndConfirm(txInitOapp, [wallet.payer]);
    console.log("Init OApp transaction confirmed:", sigInitOapp);

    const ixSetPeer = await OAppProgram.methods.setPeer({
        dstEid: DST_EID,
        peer: Array.from(PEER_ADDRESS)
    }).accounts({
        admin: wallet.publicKey,
        peer: peerPda,
        oappConfig: oappConfigPda,
        systemProgram: SystemProgram.programId
    }).signers([wallet.payer])
    .instruction();

    const txSetPeer = new Transaction().add(ixSetPeer);
    const sigSetPeer = await provider.sendAndConfirm(txSetPeer, [wallet.payer]);
    console.log("Set Peer transaction confirmed:", sigSetPeer);

    const ixSetOption = await OftTools.createSetEnforcedOptionsIx(
        wallet.publicKey,
        oappConfigPda,
        DST_EID,
        Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS, LZ_RECEIVE_VALUE).toBytes(),
        Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS, LZ_RECEIVE_VALUE).addExecutorComposeOption(0, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE).toBytes(),
        OAPP_PROGRAM_ID
    )

    const txSetOption = await provider.sendAndConfirm(new anchor.web3.Transaction().add(ixSetOption), [wallet.payer]);
    console.log("Transaction to set options:", txSetOption);
}


setup();

