import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { getAccount, closeAccount, getOrCreateAssociatedTokenAccount, transfer} from"@solana/spl-token";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import { util } from "chai";
const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 
const DST_EID = utils.getDstEid(ENV);

async function closeATA() {
    const USDC_MINT = utils.getUSDCAddress(ENV);
    const Zion_ACCOUNT = new PublicKey("Zions51qQNUgWNyp4JegUFoMUpgFx43jBUsYmHtDPdr")
    const Zion_ATA = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        USDC_MINT,
        Zion_ACCOUNT
    )
    console.log(Zion_ATA.address)
    const Wallet_ATA = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        USDC_MINT,
        wallet.publicKey
    )

    if (Wallet_ATA.amount > 0) {
        try {
            await transfer(
                provider.connection,
                wallet.payer,
                Wallet_ATA.address,
                Zion_ATA.address,
                wallet.payer,
                Wallet_ATA.amount
            )
    
        } catch (error) {
            console.error("Error transferring USDC to Zion Account", error)
            return 
        }
    } 

    await closeAccount(
        provider.connection,
        wallet.payer,
        Wallet_ATA.address,
        Zion_ACCOUNT,
        wallet.payer,  
    )
    
    console.log("Wallet ATA closed")

}

closeATA();