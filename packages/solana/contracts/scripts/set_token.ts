import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

import * as bs from "bs58";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(); 
const ENV = utils.getEnv(OAPP_PROGRAM_ID);

async function setBroker() {
    const tokenSymble = "USDC";
    const tokenHash = utils.getTokenHash(tokenSymble);
    console.log("Token Hash:", tokenHash);
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
    console.log("Set Token Params:", setTokenParams);
    const admin = wallet.publicKey;
    const multisig = new PublicKey("D6p6KbGEWEJDk1Svp9McHKDW4Umjux7swk4PBx6YE4e1");
    const setTokenAccounts = {
        admin: multisig,
        allowedToken: tokenPda,
        oappConfig: oappConfigPda,
        mintAccount: mintAccount,
    }
    console.log("Set Token Accounts:", setTokenAccounts);
    const ixSetToken = await OAppProgram.methods.setToken(setTokenParams).accounts(setTokenAccounts).instruction();

    // print ixSetToken.data as hex string
    // data type is Buffer
    console.log("ixSetToken", ixSetToken.data.toString('hex'));


    console.log("ixSetToken", ixSetToken.data);

    const txSetToken = new Transaction().add(ixSetToken);

    // txSetToken.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    // txSetToken.feePayer = wallet.publicKey;
    // console.log(txSetToken)
    // // console.log(txSetOrderDelivery.serializeMessage().toString('hex'))
    
    // console.log("txSetToken", txSetToken.serializeMessage().toString('hex'));
    // console.log("base58 encoded tx: ", bs.encode(txSetToken.serializeMessage()));

    const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetToken);

    console.log("txBase58", txBase58);

    try {
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
        
    } catch (err) {
        console.log("Error: ", err);
    }
}
setBroker();


// {"mintAccount":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","tokenHash":[214,172,161,190,151,41,193,61,103,115,53,22,19,33,100,156,204,174,106,89,21,84,119,37,22,112,15,152,111,148,46,170],"allowed":false}