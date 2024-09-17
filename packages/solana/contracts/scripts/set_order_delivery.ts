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

async function setOrderDelivery() {
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const vaultOwnerPda = utils.getVaultOwnerPda(OAPP_PROGRAM_ID);
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    const setOrderDeliveryParams = {
        orderDelivery: true,
        nonce: new anchor.BN(72), // need to fetch from lz-endpoint
    }
    const ixSetOrderDelivery = await OAppProgram.methods.setOrderDelivery(setOrderDeliveryParams).accounts({
        payer: wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
    }).instruction();

    const txSetOrderDelivery = new Transaction().add(ixSetOrderDelivery);

    const sigSetOrderDelivery = await sendAndConfirmTransaction(
        provider.connection,
        txSetOrderDelivery,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    )
    console.log("sigSetToken", sigSetOrderDelivery);
    
}
setOrderDelivery();