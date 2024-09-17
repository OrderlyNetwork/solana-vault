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

    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
   
    const ixresetVault = await OAppProgram.methods.resetVault().accounts({
        owner: wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
    }).instruction();

    const txresetVault = new Transaction().add(ixresetVault);

    const sigresetVault = await sendAndConfirmTransaction(provider.connection, txresetVault, [wallet.payer]);
    console.log("sigresetVault", sigresetVault);

}

reset();