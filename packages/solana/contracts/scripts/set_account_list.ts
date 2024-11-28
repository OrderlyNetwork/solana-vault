import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 

async function setAccountList() {
    const multisig = utils.getMultisig(ENV);
    const useMultisig = false;
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const lzReceiveTypesAccountsPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
    const accountListPda = utils.getAccountListPda(OAPP_PROGRAM_ID, oappConfigPda);
    const tokenSymble = "USDC";
    const tokenHash = utils.getTokenHash(tokenSymble);
    const tokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    const brokerId = "woofi_pro";
    const brokerHash = utils.getBrokerHash(brokerId);
    const brokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    const params = {
        accountList: accountListPda,
        usdcPda: tokenPda,
        usdcMint: utils.getUSDCAddress(rpc),
        woofiProPda: brokerPda,
    }
    const ixSetAccountList = await OAppProgram.methods.setAccountList(params).accounts({
        admin: useMultisig ? multisig : wallet.publicKey,
        oappConfig: oappConfigPda,
        lzReceiveTypes: lzReceiveTypesAccountsPda,
        accountsList: accountListPda,
    }).instruction();

    const txSetAccountList = new Transaction().add(ixSetAccountList);

    if (useMultisig) {
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetAccountList);
        console.log("txBase58 for set account list:\n", txBase58);

    } else {
        console.log("Setting up Account List...");
        const sigSetAccountList = await sendAndConfirmTransaction(
            provider.connection,
            txSetAccountList ,
            [wallet.payer],
            {
                commitment: "confirmed",
                preflightCommitment: "confirmed"
            }
        )
        console.log("sigSetAccountList ", sigSetAccountList );
    }

    
    
}
setAccountList();