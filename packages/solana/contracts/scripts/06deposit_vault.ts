import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram } from "@solana/web3.js";

import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { getLzReceiveTypesPda, getOAppConfigPda, getPeerPda, getEventAuthorityPda, getOAppRegistryPda, setAnchor, getVaultDepositAuthorityPda, createAndSendV0Tx, createAndSendV0TxWithTable, getBrokerHash, getTokenHash, getSolAccountId, getUSDCAccount, mintUSDC } from "./utils";
import { DST_EID, ENDPOINT_PROGRAM_ID, PEER_ADDRESS, LZ_RECEIVE_GAS, LZ_COMPOSE_GAS, LZ_COMPOSE_VALUE, LZ_RECEIVE_VALUE, SEND_LIB_PROGRAM_ID, TREASURY_PROGRAM_ID,EXECUTOR_PROGRAM_ID, DVN_PROGRAM_ID, PRICE_FEED_PROGRAM_ID } from "./constants";
import * as constants from "./constants";
import * as utils from "./utils";

import OAppIdl from "../target/idl/solana_vault.json";
import { SolanaVault } from "../target/types/solana_vault";
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
const OAPP_PROGRAM_ID = new PublicKey(OAppIdl.metadata.address);
const OAppProgram = anchor.workspace.SolanaVault as anchor.Program<SolanaVault>;

const [provider, wallet, rpc] = setAnchor();


async function deposit() {
    console.log("Setting up Vault...");
    const lookupTableAddresses = getTableAddresses();
    const usdc = await utils.getUSDCAddress(provider, wallet, rpc);
    const userUSDCAccount = await utils.getUSDCAccount(provider, wallet, usdc, wallet.publicKey);
    console.log("💶 User USDCAccount", userUSDCAccount.toBase58());

    if (usdc === constants.MOCK_USDC_ACCOUNT && provider.connection.rpcEndpoint === constants.LOCAL_RPC) {
        const amountToMint = 5000;
        await utils.mintUSDC(provider, wallet, usdc, userUSDCAccount, amountToMint);
    }

    const vaultDepositAuthorityPda = getVaultDepositAuthorityPda(OAPP_PROGRAM_ID, usdc);
    console.log("🔑 Vault Deposit Authority PDA:", vaultDepositAuthorityPda.toBase58());

    const vaultUSDCAccount = await utils.getUSDCAccount(provider, wallet, usdc, vaultDepositAuthorityPda);
    console.log("💶 Vault USDCAccount", vaultUSDCAccount.toBase58());

    const userInfoPda = PublicKey.findProgramAddressSync(
        [wallet.publicKey.toBuffer()],
        OAPP_PROGRAM_ID
    )[0];

    

    console.log("Init Vault:");
    try {
        const tableAddress = [usdc, vaultDepositAuthorityPda, vaultUSDCAccount, userInfoPda]

        const ixInitVault = await OAppProgram.methods.initVault().accounts({
            depositToken: usdc,
            vaultDepositAuthority: vaultDepositAuthorityPda,
            user: wallet.publicKey,

        }).instruction();
        await createAndSendV0TxWithTable([ixInitVault], provider, wallet, tableAddress);
    } catch (e) {
        console.log("Vault already initialized");
    }

    const brokerId = "woofi_pro";
    const tokenSymbol = "USDC";
    const brokerHash = getBrokerHash(brokerId);
    console.log("Broker Hash:", brokerHash);
    const codedBrokerHash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'));
    const tokenHash = getTokenHash(tokenSymbol);
    console.log("Token Hash:", tokenHash);
    const codedTokenHash = Array.from(Buffer.from(tokenHash.slice(2), 'hex'));
    const solAccountId = getSolAccountId(wallet.publicKey, brokerId);
    console.log("Sol Account Id:", solAccountId);
    const codedAccountId = Array.from(Buffer.from(solAccountId.slice(2), 'hex'));
    
    // accountId:  Array.from(Buffer.from(solAccountId.slice(2), 'hex')),
    //     brokerHash: Array.from(Buffer.from(brokerHash.slice(2), 'hex')),
    //     tokenHash:  Array.from(Buffer.from(tokenHash.slice(2), 'hex')),
    
    const vaultDepositParams = {
        accountId:  codedAccountId,
        brokerHash: codedBrokerHash,
        tokenHash:  codedTokenHash,
        srcChainId: new anchor.BN(902902902),
        tokenAmount: new anchor.BN(10_000_000),
    };

    const sendParam = {
        dstEid: DST_EID,
        to: Array.from(PEER_ADDRESS),
        options: Buffer.from(Options.newOptions().addExecutorLzReceiveOption(LZ_RECEIVE_GAS,0).toBytes()),
        message: Buffer.from("Hello, World!"),
        nativeFee: new anchor.BN(1_000_000),
        lzTokenFee: new anchor.BN(0),
    }
    const allowedBrokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
    const ixDepositEntry = await OAppProgram.methods.deposit(vaultDepositParams, sendParam).accounts({
        userInfo: userInfoPda,
        userDepositWallet: userUSDCAccount,
        vaultDepositAuthority: vaultDepositAuthorityPda,
        vaultDepositWallet: vaultUSDCAccount,
        depositToken: usdc,
        user: wallet.publicKey,
        peer: lookupTableAddresses[2],
        enforcedOptions: lookupTableAddresses[5],
        oappConfig: lookupTableAddresses[0],
        allowedBroker: allowedBrokerPda
    }).remainingAccounts([
                    // ENDPOINT solana/programs/programs/uln/src/instructions/endpoint/send.rs
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: ENDPOINT_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[0],
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: SEND_LIB_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[7], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[9], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[8], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[14], 
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: lookupTableAddresses[15], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[3], 
                    },
                    // ULN solana/programs/programs/uln/src/instructions/endpoint/send.rs
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: ENDPOINT_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[13],
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[10],
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[11],
                    },
                    {
                        isSigner: true,
                        isWritable: false,
                        pubkey: wallet.publicKey,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: TREASURY_PROGRAM_ID,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: SystemProgram.programId,
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[12], 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: SEND_LIB_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: EXECUTOR_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: lookupTableAddresses[16]
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: PRICE_FEED_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[17]
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: DVN_PROGRAM_ID
                    },
                    {
                        isSigner: false,
                        isWritable: true,
                        pubkey: lookupTableAddresses[18]
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: PRICE_FEED_PROGRAM_ID 
                    },
                    {
                        isSigner: false,
                        isWritable: false,
                        pubkey: lookupTableAddresses[17]
                    }
    ]).instruction();

    const ixAddComputeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

    console.log("Deposit Entry:");
    
    await utils.createAndSendV0TxWithTable(
        [ixDepositEntry, ixAddComputeBudget],
        provider,
        wallet,
        lookupTableAddresses
    );
    
    
}

deposit();

function getTableAddresses() {
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);
    console.log("🔑 OApp Config PDA:", oappConfigPda.toBase58());

    const lzReceiveTypesPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda);
    console.log("🔑 LZ Receive Types PDA:", lzReceiveTypesPda.toBase58());

    const peerPda = utils.getPeerPda(OAPP_PROGRAM_ID, oappConfigPda, constants.DST_EID);
    console.log("🔑 Peer PDA:", peerPda.toBase58());

    const eventAuthorityPda = utils.getEventAuthorityPda();
    console.log("🔑 Event Authority PDA:", eventAuthorityPda.toBase58());

    const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda);
    console.log("🔑 OApp Registry PDA:", oappRegistryPda.toBase58());

    const enforceOptioinsPda = utils.getEndorcedOptionsPda(OAPP_PROGRAM_ID, oappConfigPda, constants.DST_EID);
    console.log("🔑 Enforced Options PDA:", enforceOptioinsPda.toBase58());

    const sendLibPda = utils.getSendLibPda();
    console.log("🔑 Send Library PDA:", sendLibPda.toBase58());

    const sendLibConfigPda = utils.getSendLibConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Send Library Config PDA:", sendLibConfigPda.toBase58());

    const sendLibInfoPda = utils.getSendLibInfoPda(sendLibPda);
    console.log("🔑 Send Library Info PDA:", sendLibInfoPda.toBase58());

    const defaultSendLibConfigPda = utils.getDefaultSendLibConfigPda(constants.DST_EID);
    console.log("🔑 Default Send Library Config PDA:", defaultSendLibConfigPda.toBase58());

    const sendConfigPda = utils.getSendConfigPda(oappConfigPda, constants.DST_EID);
    console.log("🔑 Send Config PDA:", sendConfigPda.toBase58());

    const defaultSendConfigPda = utils.getDefaultSendConfigPda(constants.DST_EID);
    console.log("🔑 Default Send Config PDA:", defaultSendConfigPda.toBase58());

    const ulnEventAuthorityPda = utils.getUlnEventAuthorityPda();
    console.log("🔑 ULN Event Authority PDA:", ulnEventAuthorityPda.toBase58());

    const ulnSettingPda = utils.getUlnSettingPda();
    console.log("🔑 ULN Setting PDA:", ulnSettingPda.toBase58());

    const endpointSettingPda = utils.getEndpointSettingPda();
    console.log("🔑 Endpoint Setting PDA: ", endpointSettingPda.toString());

    const outboundNoncePda = utils.getOutboundNoncePda(oappConfigPda, constants.DST_EID, constants.PEER_ADDRESS);
    console.log("🔑 Outbound Nonce PDA: ", outboundNoncePda.toString());

    const executorConfigPda = utils.getExecutorConfigPda();
    console.log("🔑 Executor Config PDA: ", executorConfigPda.toString());

    const pricefeedConfigPda = utils.getPriceFeedPda();
    console.log("🔑 Price Feed Config PDA: ", pricefeedConfigPda.toString());

    const dvnConfigPda = utils.getDvnConfigPda();
    console.log("🔑 DVN Config PDA: ", dvnConfigPda.toString());

    const messageLibPda = utils.getMessageLibPda();
    console.log("🔑 Message Lib PDA: ", messageLibPda.toString());


    // const [usdcAddress, userUSDCAccount, vaultUSDCAccount] = await utils.getRelatedUSDCAcount(provider, wallet, rpc);
    // console.log("💶 USDC Address: ", usdcAddress.toString());
    // console.log("💶 User USDC Account: ", userUSDCAccount.toString());
    // console.log("💶 Vault USDC Account: ", vaultUSDCAccount.toString());
    //                              0                   1            2             3                  4                 5               6             7                 8                    9                  10                 11                   12                 13              14                   15              16                 17                18             19           
    const lookupTableAddress = [oappConfigPda, lzReceiveTypesPda, peerPda, eventAuthorityPda, oappRegistryPda, enforceOptioinsPda, sendLibPda, sendLibConfigPda, sendLibInfoPda, defaultSendLibConfigPda, sendConfigPda, defaultSendConfigPda, ulnEventAuthorityPda, ulnSettingPda, endpointSettingPda, outboundNoncePda, executorConfigPda, pricefeedConfigPda, dvnConfigPda, messageLibPda];
    return lookupTableAddress;
}