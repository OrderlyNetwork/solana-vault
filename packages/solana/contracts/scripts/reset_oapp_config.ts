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

    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);


    const vaultOwnerPda = utils.getVaultOwnerPda(OAPP_PROGRAM_ID);
   
    const ixResetOApp = await OAppProgram.methods.resetOappConfig().accounts({
        payer: wallet.publicKey,
        oappConfig: oappConfigPda,
        vaultOwner: vaultOwnerPda
    }).instruction();

    const txResetOApp = new Transaction().add(ixResetOApp);

    const sigResetOApp = await sendAndConfirmTransaction(provider.connection, txResetOApp, [wallet.payer]);
    console.log("sigResetOApp", sigResetOApp);



}

reset();