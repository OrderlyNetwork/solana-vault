import * as anchor from "@coral-xyz/anchor";
import { PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { setAnchor, getOAppConfigPda,  getTokenHash, getUSDCAddress, getTokenPda, getVaultOwnerPda } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();



async function reinit() {

    const tokenSymble = "USDC";
    const tokenHash = getTokenHash(tokenSymble);
    const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    const mintAccount = await getUSDCAddress(provider, wallet, rpc);
    console.log("USDC mintAccount", mintAccount.toBase58());
    const tokenPda = getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    console.log("tokenPda", tokenPda.toBase58());
    const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);
    const vaultOwnerPda = getVaultOwnerPda(OAPP_PROGRAM_ID);





    const reinitOAppParams = {
        admin: wallet.publicKey,
        endpointProgram: ENDPOINT_PROGRAM_ID,
        usdcHash: codedTokenHash,
        usdcMint: mintAccount,
    };

    const ixReinitOAppConfig = await OAppProgram.methods.reinitOappConfig(reinitOAppParams).accounts({
        payer: wallet.publicKey,
        oappConfig: oappConfigPda,
        vaultOwner: vaultOwnerPda
    }).instruction();

    const txReinitOAppConfig = new Transaction().add(ixReinitOAppConfig);
    const sigReinitOAppConfig = await sendAndConfirmTransaction(provider.connection, txReinitOAppConfig, [wallet.payer]);
    console.log("sigReinitOAppConfig", sigReinitOAppConfig);


}

reinit();