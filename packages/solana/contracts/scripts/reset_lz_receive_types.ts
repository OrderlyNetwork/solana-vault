import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = utils.setAnchor();



async function reset() {

    const oappConfig = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const lzReceiveTypesPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfig);
    const ixResetLzReceiveTypes = await OAppProgram.methods.resetLzReceiveTypes().accounts({
        admin: wallet.publicKey,
        oappConfig: oappConfig,
        lzReceiveTypes: lzReceiveTypesPda,
    }).instruction();

    const txResetLzReceiveTypes = new Transaction().add(ixResetLzReceiveTypes);

    const sigResetLzReceiveTypes = await sendAndConfirmTransaction(provider.connection, txResetLzReceiveTypes, [wallet.payer]);
    console.log("sigResetLzReceiveTypes", sigResetLzReceiveTypes);

}

reset();