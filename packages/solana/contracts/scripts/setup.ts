import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { ENFORCED_OPTIONS_SEED, EVENT_SEED, LZ_RECEIVE_TYPES_SEED, OAPP_SEED, PEER_SEED, OftTools, getEndpointProgramId } from "@layerzerolabs/lz-solana-sdk-v2";
import { addressToBytes32, Options} from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE } from "./constants";
import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet] = setAnchor();

const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);
console.log("OApp Config PDA:", oappConfigPda.toBase58());

const lzReceiveTypesPda = getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
console.log("LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

const peerPda = getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
console.log("Peer PDA:", peerPda.toBase58());

const eventAuthorityPda = getEventAuthorityPda();
console.log("Event Authority PDA:", eventAuthorityPda.toBase58());

const oappRegistryPubkey = getOAppRegistryPda(oappConfigPda);
console.log("OApp Registry PDA:", oappRegistryPubkey.toBase58());

async function setup() {
    const txInitOapp = await OAppProgram.methods.initOapp({
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
                pubkey: oappRegistryPubkey
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
    ).signers([wallet.payer])
    .rpc();
    console.log("Transaction to init OApp:", txInitOapp);

    const TxSetPeer = await OAppProgram.methods.setPeer({
        dstEid: DST_EID,
        peer: Array.from(PEER_ADDRESS)
    }).accounts({
        admin: wallet.publicKey,
        peer: peerPda,
        oappConfig: oappConfigPda,
        systemProgram: SystemProgram.programId
    }).signers([wallet.payer])
    .rpc();
    console.log("Transaction to set peer:", TxSetPeer);

    const IxSetOption = await OftTools.createSetEnforcedOptionsIx(
        wallet.publicKey,
        oappConfigPda,
        DST_EID,
        Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS, LZ_RECEIVE_VALUE).toBytes(),
        Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS, LZ_RECEIVE_VALUE).addExecutorComposeOption(0, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE).toBytes(),
        OAPP_PROGRAM_ID
    )

    const txSetOption = await provider.sendAndConfirm(new anchor.web3.Transaction().add(IxSetOption), [wallet.payer]);
    console.log("Transaction to set options:", txSetOption);
}

setup();

