import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getOAppConfigPda, setAnchor, getVaultOwnerPda} from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE } from "./constants";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();

async function setOrderDelivery() {
    const oappConfigPda = getOAppConfigPda(OAPP_PROGRAM_ID);
    const vaultOwnerPda = getVaultOwnerPda(OAPP_PROGRAM_ID);
    const setOrderDeliveryParams = {
        orderDelivery: true,
        nonce: new anchor.BN(0), // need to fetch from lz-endpoint
    }
    const ixSetOrderDelivery = await OAppProgram.methods.setOrderDelivery(setOrderDeliveryParams).accounts({
        payer: wallet.publicKey,
        oappConfig: oappConfigPda,
        vaultOwner: vaultOwnerPda,
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