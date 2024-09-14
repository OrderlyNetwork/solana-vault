import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor, getBrokerHash, getBrokerPda, getTokenHash, getTokenPda, getUSDCAddress } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();

async function setBroker() {
    const tokenSymble = "USDC";
    const tokenHash = getTokenHash(tokenSymble);
    const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    const mintAccount = await getUSDCAddress(provider, wallet, rpc);
    console.log("USDC mintAccount", mintAccount.toBase58());
    const tokenPda = getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    console.log("tokenPda", tokenPda.toBase58());

    const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);

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