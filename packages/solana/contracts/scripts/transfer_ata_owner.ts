import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import { oft } from "@layerzerolabs/oft-v2-solana-sdk";

import {
    TOKEN_PROGRAM_ID,
    getOrCreateAssociatedTokenAccount,
    createMint,
    mintTo,
    getAccount,
    Account,
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    freezeAccount,
    setAuthority,
  } from '@solana/spl-token'
const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 
const USDC_MINT = utils.getUSDCAddress(ENV);

async function transferATAOnwer() {
   

    const usdcWallet = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        USDC_MINT,
        wallet.payer.publicKey,
        false,
        "confirmed",
    )

    console.log("usdcWallet", usdcWallet);
    
    // const newOnwer = new anchor.web3.PublicKey("Zions51qQNUgWNyp4JegUFoMUpgFx43jBUsYmHtDPdr");

    // const sig = await setAuthority(
    //     provider.connection,
    //     wallet.payer,
    //     usdcWallet.address,
    //     wallet.payer,
    //     2,
    //     newOnwer,  
    // )

    // const usdcWallet2 = await getAccount(
    //     provider.connection,
    //     usdcWallet.address,
    // )

    // console.log("usdcWallet", usdcWallet2);
    

    
}

transferATAOnwer();