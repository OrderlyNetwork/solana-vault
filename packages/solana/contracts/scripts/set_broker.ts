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
    const brokerId = "woofi_pro";
    const brokerHash = utils.getBrokerHash(brokerId);
    const codedBrokerHash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'));
    const brokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    console.log("brokerPda", brokerPda.toBase58());

    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);

    const allowed = true;
    const setBrokerParams = {
        brokerHash: codedBrokerHash,
        allowed: allowed,
    };
    const ixSetBroker = await OAppProgram.methods.setBroker(setBrokerParams).accounts({
        admin: wallet.publicKey,
        allowedBroker: brokerPda,
        oappConfig: oappConfigPda,
    }).instruction();

    const txSetBroker = new Transaction().add(ixSetBroker);

    const sigSetBroker = await sendAndConfirmTransaction(
        provider.connection,
        txSetBroker,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    )
    console.log("sigSetBroker", sigSetBroker);
    
}
setBroker();