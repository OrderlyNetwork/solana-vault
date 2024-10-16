import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv(OAPP_PROGRAM_ID);
const DST_EID = utils.getDstEid(ENV);
const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);

console.log("OApp Config PDA:", oappConfigPda.toBase58());



async function setup() {
    console.log("Setting up OApp...");
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

