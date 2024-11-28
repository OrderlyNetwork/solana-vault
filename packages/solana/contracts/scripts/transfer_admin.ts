import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import { oft } from "@layerzerolabs/oft-v2-solana-sdk";
const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 

async function transferAdmin() {
    const multisig = utils.getMultisig(ENV);
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    const DST_EID = utils.getDstEid(ENV);
    const SOL_CHAIN_ID = utils.getSolChainId(ENV);

    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);

    let vaultAuthorityPdaData, setVaultParams;
    vaultAuthorityPdaData = await OAppProgram.account.vaultAuthority.fetch(vaultAuthorityPda);

    // console.log("Vault Authority PDA: ", vaultAuthorityPda.toBase58());
    // console.log("   - vault owner: ", new PublicKey(vaultAuthorityPdaData.owner).toBase58());
    // console.log("   - sol chain id: ", Number(vaultAuthorityPdaData.solChainId));
    // console.log("   - dst eid: ", Number(vaultAuthorityPdaData.dstEid));
    // console.log("   - deposit nonce: ", Number(vaultAuthorityPdaData.depositNonce));
    // console.log("   - order delivery: ", vaultAuthorityPdaData.orderDelivery);
    // console.log("   - inbound nonce: ", Number(vaultAuthorityPdaData.inboundNonce));

    setVaultParams = {
        owner: multisig,
        depositNonce: new anchor.BN(vaultAuthorityPdaData.depositNonce),
        orderDelivery: true,
        inboundNonce: new anchor.BN(vaultAuthorityPdaData.inboundNonce),
        dstEid: DST_EID,
        solChainId: new anchor.BN(SOL_CHAIN_ID)
    }
    const setVaultAccounts = {
        admin: wallet.publicKey,
        vaultAuthority: vaultAuthorityPda,
        oappConfig: utils.getOAppConfigPda(OAPP_PROGRAM_ID),
    }
    // console.log("Set Vault Accounts:", setVaultAccounts);
    const ixSetVault = await OAppProgram.methods.setVault(setVaultParams).accounts(setVaultAccounts).instruction();
    console.log("Transfer Vault Owner:");
    const sigSetVault = await utils.createAndSendV0Tx([ixSetVault], provider, wallet);

    console.log("Set delegate and transfer admin...");
    const ixSetDelegate = await OftTools.createSetDelegateIx(
        wallet.publicKey,
        oappConfigPda,
        multisig,
        OAPP_PROGRAM_ID,
        constants.ENDPOINT_PROGRAM_ID
    )
    
    const transferAdminParams = {
        admin: multisig,
    };
    const ixTransferAdmin = await OAppProgram.methods.transferAdmin(transferAdminParams).accounts({
        admin: wallet.publicKey,
        oappConfig: oappConfigPda,
    }).instruction();
    const txSetDelegateAndAdmin = new Transaction().add(ixSetDelegate).add(ixTransferAdmin);
 
    const sigTransferAdmin = await sendAndConfirmTransaction(
        provider.connection,
        txSetDelegateAndAdmin,
        [wallet.payer],
        {
            commitment: "confirmed",
            preflightCommitment: "confirmed"
        }
    )
    console.log("sigTransferAdmin", sigTransferAdmin);  
}

transferAdmin();