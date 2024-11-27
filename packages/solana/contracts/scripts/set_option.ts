import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const OAPP_PROGRAM_ID = utils.getProgramID(ENV); 

const DST_EID = utils.getDstEid(ENV);
const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);

// console.log("OApp Config PDA:", oappConfigPda.toBase58());

async function setup() {
    const multisig = utils.getMultisig(ENV);
    const useMultisig = true;
    console.log("Setting up OApp...");
    const ixSetOption = await OftTools.createSetEnforcedOptionsIx(
        useMultisig? multisig : wallet.publicKey,
        oappConfigPda,
        DST_EID,
        Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorOrderedExecutionOption().toBytes(),
        Options.newOptions().addExecutorLzReceiveOption(constants.LZ_RECEIVE_GAS, constants.LZ_RECEIVE_VALUE).addExecutorComposeOption(0, constants.LZ_COMPOSE_GAS, constants.LZ_COMPOSE_VALUE).toBytes(),
        OAPP_PROGRAM_ID
    )
    const txSetOption = new anchor.web3.Transaction().add(ixSetOption)
    if (useMultisig) {
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetOption);
        console.log("txBase58 for set option:\n", txBase58);
    } else {
        console.log("Setting up Options...");
        const sigSetOption = await provider.sendAndConfirm(txSetOption, [wallet.payer]);
        console.log("Transaction to set options:", sigSetOption);
    }
    
}


setup();

