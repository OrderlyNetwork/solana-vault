import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";

const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  

const ENV = utils.getEnv(OAPP_PROGRAM_ID);
const DST_EID = utils.getDstEid(ENV);

async function setOrderDelivery() {
    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);

    const vaultAuthorityPdaData = await OAppProgram.account.vaultAuthority.fetch(vaultAuthorityPda);

    console.log("Vault Authority PDA: ", vaultAuthorityPda.toBase58());
    console.log("   - vault owner: ", new PublicKey(vaultAuthorityPdaData.owner).toBase58());
    console.log("   - sol chain id: ", Number(vaultAuthorityPdaData.solChainId));
    console.log("   - dst eid: ", Number(vaultAuthorityPdaData.dstEid));
    console.log("   - deposit nonce: ", Number(vaultAuthorityPdaData.depositNonce));
    console.log("   - order delivery: ", vaultAuthorityPdaData.orderDelivery);
    console.log("   - inbound nonce: ", Number(vaultAuthorityPdaData.inboundNonce));
    const setOrderDeliveryParams = {
        orderDelivery: false,
        nonce: vaultAuthorityPdaData.inboundNonce, // need to fetch from lz-endpoint
    }
    const ixSetOrderDelivery = await OAppProgram.methods.setOrderDelivery(setOrderDeliveryParams).accounts({
        owner: wallet.publicKey,
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