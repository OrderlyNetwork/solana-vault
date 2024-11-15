import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(); 
const ENV = utils.getEnv(OAPP_PROGRAM_ID);

async function setAccountList() {
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
        admin: wallet.publicKey,
        oappConfig: oappConfigPda,
        lzReceiveTypes: lzReceiveTypesAccountsPda,
        accountsList: accountListPda,
    }).instruction();

    const txSetAccountList = new Transaction().add(ixSetAccountList);

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
setAccountList();