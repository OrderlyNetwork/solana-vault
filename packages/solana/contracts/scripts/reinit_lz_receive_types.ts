import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import * as utils from "./utils";
import * as constants from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv(OAPP_PROGRAM_ID);
const DST_EID = utils.getDstEid(ENV);
const SOL_CHAIN_ID = utils.getSolChainId(ENV);



async function reinit() {

    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const lzReceiveTypesPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
    const tokenSymble = "USDC";
    const tokenHash = utils.getTokenHash(tokenSymble);
    const tokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    console.log("tokenPda", tokenPda.toBase58());
    const reinitLzReceiveTypesParams = {
        oappConfig: oappConfigPda,
        allowedUsdc: tokenPda,
    };

    const ixReinitLzReceiveTypes  = await OAppProgram.methods.reinitLzReceiveTypes(reinitLzReceiveTypesParams).accounts({
        admin: wallet.publicKey,
        oappConfig: oappConfigPda,
        lzReceiveTypes: lzReceiveTypesPda,
    }).instruction();

    const txReinitLzReceiveTypes  = new Transaction().add(ixReinitLzReceiveTypes );
    const sigReinitLzReceiveTypes  = await sendAndConfirmTransaction(provider.connection, txReinitLzReceiveTypes , [wallet.payer]);
    console.log("sigReinitLzReceiveTypes", sigReinitLzReceiveTypes);

}

reinit();