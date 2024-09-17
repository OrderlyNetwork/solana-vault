import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = utils.setAnchor();

async function setBroker() {
    const tokenSymble = "USDC";
    const tokenHash = utils.getTokenHash(tokenSymble);
    const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    const mintAccount = utils.getUSDCAddress(rpc);
    console.log("USDC mintAccount", mintAccount.toBase58());
    const tokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    console.log("tokenPda", tokenPda.toBase58());

    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);

    const allowed = true;
    const setTokenParams = {
        mintAccount: mintAccount,
        tokenHash: codedTokenHash,
        allowed: allowed,
    };
    const ixSetToken = await OAppProgram.methods.setToken(setTokenParams).accounts({
        admin: wallet.publicKey,
        allowedToken: tokenPda,
        oappConfig: oappConfigPda,
        mintAccount: mintAccount,
    }).instruction();

    const txSetToken = new Transaction().add(ixSetToken);

    const sigSetToken = await sendAndConfirmTransaction(
        provider.connection,
        txSetToken,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    )
    console.log("sigSetToken", sigSetToken);
    
}
setBroker();