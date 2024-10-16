import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import { hexlify } from '@ethersproject/bytes'

import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";
import { PacketPath } from '@layerzerolabs/lz-v2-utilities'
import { EndpointProgram, EventPDADeriver, SimpleMessageLibProgram, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'




import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv(OAPP_PROGRAM_ID);



async function deposit() {
    console.log("Setting up Vault...");
    const lookupTableList = utils.printPda(OAPP_PROGRAM_ID, wallet, rpc, ENV);
    const senderAddress = wallet.publicKey;
    // const receiverAddress = new PublicKey("9aFZUMoeVRvUnaE34RsHxpcJXvFMPPSWrG3QDNm6Sskf");

    const receiverAddress = senderAddress;
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
    

    
    const vaultDepositParams = {
        accountId:  codedAccountId,
        brokerHash: codedBrokerHash,
        tokenHash:  codedTokenHash,
        userAddress: Array.from(receiverAddress.toBuffer()),
        tokenAmount: new anchor.BN(1_000_000_000),
    };


    const sendParam = {
        nativeFee: new anchor.BN(1_000_000_000),
        lzTokenFee: new anchor.BN(0),
    }
    const allowedBrokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    const allowedTokenPda = utils.getTokenPda(OAPP_PROGRAM_ID, tokenHash);
    const ixDepositEntry = await OAppProgram.methods.deposit(vaultDepositParams, sendParam).accounts({
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
    }).remainingAccounts([
                    // ENDPOINT solana/programs/programs/uln/src/instructions/endpoint/send.rs
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.ENDPOINT_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[0],
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.SEND_LIB_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[7], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[9], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[8], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[14], 
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: lookupTableList[15], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[3], 
                    },
                    // ULN solana/programs/programs/uln/src/instructions/endpoint/send.rs
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.ENDPOINT_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[13],
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[10],
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[11],
                    },
                    {
                        isSigner: true,
                        isWritable: false,
                        pubkey: wallet.publicKey,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.TREASURY_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: SystemProgram.programId,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[12], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.SEND_LIB_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.EXECUTOR_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: lookupTableList[16]
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.PRICE_FEED_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[17]
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.DVN_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: lookupTableList[18]
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: constants.PRICE_FEED_PROGRAM_ID 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableList[17]
                    }
    ]).instruction();

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
