import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  

const [provider, wallet, rpc] = utils.setAnchor();

const ENV = utils.getEnv(OAPP_PROGRAM_ID);
const DST_EID = utils.getDstEid(ENV);

const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
console.log("OApp Config PDA:", oappConfigPda.toBase58());

const lzReceiveTypesPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
console.log("LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, DST_EID);
console.log("Peer PDA:", peerPda.toBase58());

const eventAuthorityPda = utils.getEventAuthorityPda();
console.log("Event Authority PDA:", eventAuthorityPda.toBase58());

const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda);
console.log("OApp Registry PDA:", oappRegistryPda.toBase58());

const vaultOwnerPda = utils.getVaultOwnerPda(OAPP_PROGRAM_ID);
console.log("Owner PDA:", vaultOwnerPda.toBase58());

async function setup() {
    console.log("Setting up OApp...");
    const tokenSymble = "USDC";
    const tokenHash = utils.getTokenHash(tokenSymble);
    const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    const mintAccount = await utils.getUSDCAddress(rpc);

    const ixInitOapp = await OAppProgram.methods.initOapp({
        admin: wallet.publicKey,
        endpointProgram: constants.ENDPOINT_PROGRAM_ID,
        usdcHash: codedTokenHash,
        usdcMint: mintAccount,
    }).accounts({
        payer: wallet.publicKey,
        oappConfig: oappConfigPda,
        lzReceiveTypes: lzReceiveTypesPda,
        systemProgram: SystemProgram.programId
    }).remainingAccounts(
        [
            {
                isSigner: false,
                isWritable: false,
                pubkey: constants.ENDPOINT_PROGRAM_ID,
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
                pubkey: constants.ENDPOINT_PROGRAM_ID
            },
        ]
    ).instruction();
    
    const txInitOapp = new Transaction().add(ixInitOapp);
    const sigInitOapp = await provider.sendAndConfirm(txInitOapp, [wallet.payer]);
    console.log("Init OApp transaction confirmed:", sigInitOapp);

    const peerAddress = utils.getPeerAddress(ENV);
    const ixSetPeer = await OAppProgram.methods.setPeer({
        dstEid: DST_EID,
        peer: Array.from(peerAddress)
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
        Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorOrderedExecutionOption().toBytes(),
        Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorComposeOption(0, constants.LZ_COMPOSE_GAS, constants.LZ_COMPOSE_VALUE).toBytes(),
        OAPP_PROGRAM_ID
    )

    const txSetOption = await provider.sendAndConfirm(new anchor.web3.Transaction().add(ixSetOption), [wallet.payer]);
    console.log("Transaction to set options:", txSetOption);
}


setup();

