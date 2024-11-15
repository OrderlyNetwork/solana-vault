import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import { hexlify } from '@ethersproject/bytes'

import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import { PacketPath } from '@layerzerolabs/lz-v2-utilities'
import { EndpointProgram, EventPDADeriver, SimpleMessageLibProgram, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(); 
const ENV = utils.getEnv(OAPP_PROGRAM_ID);



async function deposit() {
    console.log("Setting up Vault...");
    const lookupTableList = utils.printPda(OAPP_PROGRAM_ID, wallet, rpc, ENV);
    const senderAddress = wallet.publicKey;
    // flag: 9TJTNxsieXTSWebMRb5KbMiDDwfLJAeWa76NcPjbao42, 
    // tony: 9aFZUMoeVRvUnaE34RsHxpcJXvFMPPSWrG3QDNm6Sskf,
    // eric: 4NQEN28HJgWSRKeXB6Apcz6Fn9GHEH1f4Qjhpf4Vwy6B, 7aabN75pTupDnFRWmMQwrgprn1uLVdAr7tzP61yKbGwD
    const receiverAddress = new PublicKey("2kgwRP2VexGBHLmh97AoqDLSe1D9oms4ovEdbvM66Jn9");  

    // const receiverAddress = senderAddress;
    const usdc = utils.getUSDCAddress(rpc);
    const userUSDCAccount = utils.getUSDCAccount(usdc, senderAddress);
    console.log("💶 User USDCAccount", userUSDCAccount.toBase58());

    if (usdc === constants.MOCK_USDC_ACCOUNT && provider.connection.rpcEndpoint === constants.LOCAL_RPC) {
        const amountToMint = 5000;
        await utils.mintUSDC(provider, wallet, usdc, userUSDCAccount, amountToMint);
    }

    const vaultAuthorityPda = utils.getVaultAuthorityPda(OAPP_PROGRAM_ID);
    console.log("🔑 Vault Deposit Authority PDA:", vaultAuthorityPda.toBase58());

    const vaultUSDCAccount = await utils.getUSDCAccount(usdc, vaultAuthorityPda);
    console.log("💶 Vault USDCAccount", vaultUSDCAccount.toBase58());

    const brokerId = "woofi_pro";
    const tokenSymbol = "USDC";
    const brokerHash = utils.getBrokerHash(brokerId);
    console.log("Broker Hash:", brokerHash);
    const codedBrokerHash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'));
    const tokenHash = utils.getTokenHash(tokenSymbol);
    console.log("Token Hash:", tokenHash);

    const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    const solAccountId = utils.getSolAccountId(receiverAddress, brokerId); 
    console.log("Sol Account Id:", solAccountId);
    const codedAccountId = Array.from(Buffer.from(solAccountId.slice(2), 'hex'));
    

    
    const depositParams = {
        accountId:  codedAccountId,
        brokerHash: codedBrokerHash,
        tokenHash:  codedTokenHash,
        userAddress: Array.from(receiverAddress.toBuffer()),
        tokenAmount: new anchor.BN(10_000_000),
    };


    
    const allowedBrokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    const allowedTokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    const quoteRemainingAccounts = utils.getQuoteRemainingAccounts(OAPP_PROGRAM_ID, ENV);
    const oappConfigPda = lookupTableList[0];
    const peerPda = lookupTableList[2];
    const enforcedOptionsPda = lookupTableList[5];
    const {nativeFee, lzTokenFee } = await OAppProgram.methods
    .oappQuote(depositParams)
    .accounts({
        oappConfig: oappConfigPda,
        peer: peerPda,
        enforcedOptions: enforcedOptionsPda,
        vaultAuthority: vaultAuthorityPda,
    })
    .remainingAccounts(quoteRemainingAccounts)
    .view();

    console.log("Native Fee:", nativeFee.toString());

    const sendParam = {
        nativeFee: new anchor.BN(nativeFee),
        lzTokenFee: new anchor.BN(0),
    }
    const depositRemainingAccounts = utils.getDepositRemainingAccounts(OAPP_PROGRAM_ID, ENV, wallet);
    const ixDepositEntry = await OAppProgram.methods.deposit(depositParams, sendParam).accounts({
        userTokenAccount: userUSDCAccount,
        vaultAuthority: vaultAuthorityPda,
        vaultTokenAccount: vaultUSDCAccount,
        depositToken: usdc,
        user: wallet.publicKey,
        peer: lookupTableList[2],
        enforcedOptions: lookupTableList[5],
        oappConfig: lookupTableList[0],
        allowedBroker: allowedBrokerPda,
        allowedToken: allowedTokenPda
    }).remainingAccounts(depositRemainingAccounts).instruction();
    const ixAddComputeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

    console.log("Deposit Entry:");
    
    await utils.createAndSendV0TxWithTable(
        [ixDepositEntry, ixAddComputeBudget],
        provider,
        wallet,
        lookupTableList,
        ENV
    );
    
    
}

deposit();