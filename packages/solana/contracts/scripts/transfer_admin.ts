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

async function transferAdmin() {
    const newAdmin = new PublicKey("CGN7Ad1FnLUEVkkwA3JzhgdphiRVQGSdzpMiMLe6WDjk");
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const transferAdminParams = {
        admin: newAdmin,
    };
    const ixTransferAdmin = await OAppProgram.methods.transferAdmin(transferAdminParams).accounts({
        admin: wallet.publicKey,
        oappConfig: oappConfigPda,
    }).instruction();

    const txTransferAdmin = new Transaction().add(ixTransferAdmin);
    const sigTransferAdmin = await sendAndConfirmTransaction(
        provider.connection,
        txTransferAdmin,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    )
    console.log("sigTransferAdmin", sigTransferAdmin);
}

transferAdmin();