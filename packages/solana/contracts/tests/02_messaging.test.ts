import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from './types/endpoint'
import * as helper from './helper'
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  createMint,
  mintTo,
  getAccount,
  Account,
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  freezeAccount,
  thawAccount,
  transfer,
  closeAccount,
  setAuthority,
} from '@solana/spl-token'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { assert } from 'chai'
import endpointIdl from './idl/endpoint.json'
import { MainnetV2EndpointId } from '@layerzerolabs/lz-definitions'
import { initOapp, setVault, confirmOptions, setPeer, setEnforcedOptions, initEndpoint, registerLibrary, initSendLibrary, initDefaultSendLibrary, initUln, initNonce } from './setup'
import * as utils from '../scripts/utils'
import * as setup from './setup'




describe('Test OAPP messaging', function() {
    console.log("Messaging test")
    const { provider, wallet, endpointProgram, ulnProgram, solanaVault } = helper.prepareEnviroment()

    const ORDERLY_EID = MainnetV2EndpointId.ORDERLY_V2_MAINNET
    const DST_EID = ORDERLY_EID
    const SOLANA_EID = MainnetV2EndpointId.SOLANA_V2_MAINNET
    anchor.setProvider(provider)
  
    const usdcMintAuthority = Keypair.generate()
    const userWallet = Keypair.generate()
    const attackerWallet = Keypair.generate();
    const endpointAdmin = wallet.payer
    let USDC_MINT: PublicKey
    const DEPOSIT_AMOUNT = 1e9;    // 1000 USDC
    const WITHDRAW_AMOUNT = 1e9;   // 1000 USDC
    const WITHDRAW_FEE = 1e6;      // 1 USDC
    const LZ_FEE = 1000;
    let oappConfigPda: PublicKey
    let userUSDCAccount: Account
    let vaultUSDCAccount: Account
    let attackerUSDCAccount: Account
    const vaultAuthorityPda = utils.getVaultAuthorityPda(solanaVault.programId)
    let sendLibraryConfigPda: PublicKey
    let defaultSendLibraryConfigPda: PublicKey
    let messageLibInfoPda: PublicKey
    let messageLibPda: PublicKey
    let MEME_MINT: PublicKey
    let userMEMEAccount: Account
    let vaultMEMEAccount: Account
    let attackerMEMEAccount: Account
    let noncePda: PublicKey
    let pendingInboundNoncePda: PublicKey
    let currVaultUSDCBalance
    let prevVaultUSDCBalance
    let currUserUSDCBalance
    let prevUserUSDCBalance
    
    let currVaultMEMEBalance
    let prevVaultMEMEBalance
    let currUserMemeBalance
    let prevUserMemeBalance   
    const memeMintAuthority = Keypair.generate()
    const usdcSymbol = helper.USDC_SYMBOL
    const woofiProBrokerId = helper.WOOFI_PRO_BROKER_ID
    const usdcHash = helper.getTokenHash(usdcSymbol)
    const woofiProBrokerHash = helper.getBrokerHash(woofiProBrokerId)

    const peerAddress = helper.PEER_ADDRESS
    const msgSender = new PublicKey(peerAddress)
    before("Preparing for tests", async () => {
        console.log("Start messaging test")
        // deploy a USDC mint
        USDC_MINT = await createMint(
            provider.connection,
            wallet.payer,
            usdcMintAuthority.publicKey,
            usdcMintAuthority.publicKey,
            6,  // USDC has 6 decimals
            Keypair.generate(),
            confirmOptions
        )
        console.log("✅ Deploy USDC coin")

        await provider.connection.requestAirdrop(userWallet.publicKey, 1e9)
        // Setup Wallets
        userUSDCAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            userWallet.publicKey
        )
        vaultUSDCAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            vaultAuthorityPda,
            true                // prevent TokenOwnerOffCurveError,
        )
        attackerUSDCAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            attackerWallet.publicKey,
            true       
        )
        console.log("✅ Setup Wallets for USDC coin")

        oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)

      
        // deploy a memecoin
        MEME_MINT = await createMint(
            provider.connection,
            wallet.payer,
            memeMintAuthority.publicKey,
            null,
            6, // MEME has 6 decimals
            Keypair.generate(),
            confirmOptions
        );
        console.log("✅ Deploy MEME coin")

        // Setup Wallets for MEME coin
        userMEMEAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            MEME_MINT,
            userWallet.publicKey
        )
        vaultMEMEAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            MEME_MINT,
            vaultAuthorityPda,
            true
        ) 

        attackerMEMEAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            MEME_MINT,
            attackerWallet.publicKey,
        )
        console.log("✅ Setup Wallets for MEME coin")  

    })

    it('Deposit tests', async() => {
        console.log("🚀 Starting deposit tests")

        const allowedTokenPda = utils.getTokenPdaWithBuf(solanaVault.programId, usdcHash)
        const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
         
        const setTokenParams = {
            mintAccount: USDC_MINT,
            tokenHash: usdcHash,
            allowed: true
        }
        
        const setTokenAccounts = {
            admin: wallet.publicKey,
            allowedToken: allowedTokenPda,
            mintAccount: USDC_MINT,
            oappConfig: oappConfigPda
        }

        await setup.setToken(wallet.payer, solanaVault, setTokenParams, setTokenAccounts)
        console.log("✅ Set USDC Token")

        const allowedBrokerPda = utils.getBrokerPdaWithBuf(solanaVault.programId, woofiProBrokerHash)

        const setBrokerParams = {
            brokerHash: woofiProBrokerHash,
            allowed: true
        }

        const setBrokerAccounts = {
            admin: wallet.publicKey,
            allowedBroker: allowedBrokerPda,
            oappConfig: oappConfigPda,
            systemProgram: SystemProgram.programId
        }

        await setup.setBroker(wallet.payer, solanaVault, setBrokerParams, setBrokerAccounts)
        
        
        console.log("✅ Set WoofiPro Broker")

        await helper.mintTokenTo(
            provider.connection,
            wallet.payer,
            usdcMintAuthority,
            USDC_MINT,
            userUSDCAccount.address,
            DEPOSIT_AMOUNT // 1000 USDC
        )
        console.log(`✅ Minted ${DEPOSIT_AMOUNT} USDC to user deposit wallet`)
        
        const peerPda = utils.getPeerPda(solanaVault.programId, oappConfigPda, DST_EID)
      
        const efOptionsPda = utils.getEnforcedOptionsPda(solanaVault.programId, oappConfigPda, DST_EID)

        const noncePda = utils.getNoncePda(oappConfigPda, DST_EID, peerAddress)
        prevVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)

        const solAccountId = Array.from(Buffer.from(utils.getSolAccountId(userWallet.publicKey, woofiProBrokerId).slice(2), 'hex'));

        const depositParams = {
            accountId: solAccountId,
            brokerHash: woofiProBrokerHash,
            tokenHash: usdcHash,
            userAddress: Array.from(userWallet.publicKey.toBytes()),
            tokenAmount: new BN(DEPOSIT_AMOUNT),
        }

        
        const feeParams = {
            nativeFee: new BN(LZ_FEE),
            lzTokenFee: new BN(0)
        }

        const accounts = {
            user: userWallet.publicKey,
            userTokenAccount: userUSDCAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultUSDCAccount.address,
            depositToken: USDC_MINT,
            peer: peerPda,
            enforcedOptions: efOptionsPda,
            oappConfig: oappConfigPda,
            allowedBroker: allowedBrokerPda,
            allowedToken: allowedTokenPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId
        }

        sendLibraryConfigPda = utils.getSendLibConfigPda(oappConfigPda, DST_EID)
        defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(DST_EID)
        const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
        messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)

        let nonce = await endpointProgram.account.nonce.fetch(noncePda)
        const depositRemainingAccounts = await helper.getDepositRemainingAccounts(solanaVault, endpointProgram, ulnProgram)
       
        await setup.deposit(userWallet, solanaVault, depositParams, feeParams, accounts, depositRemainingAccounts)
      
        nonce = await endpointProgram.account.nonce.fetch(noncePda)
        // assert.ok(nonce.outboundNonce.eq(new BN(1)))

        const vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        // assert.ok(vaultAuthority.depositNonce.eq(new BN(1)))

        currUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)
        assert.equal(currUserUSDCBalance, prevUserUSDCBalance - DEPOSIT_AMOUNT)
        
        currVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(currVaultUSDCBalance, prevVaultUSDCBalance + DEPOSIT_AMOUNT)
        console.log("✅ Check account states after deposit")

        console.log("✅ Executed deposit USDC")

        const attackerAccountId = Array.from(Buffer.from(utils.getSolAccountId(attackerWallet.publicKey, woofiProBrokerId).slice(2), 'hex'));
        const invalidAccountId = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        try {
            console.log("🥷 Attacker tries to deposit with invalid account id")
            const paramsWithdrawInvalidAccountId = {
                accountId: invalidAccountId,
                brokerHash: woofiProBrokerHash,
                tokenHash: usdcHash,
                userAddress: Array.from(attackerWallet.publicKey.toBytes()),
                tokenAmount: new BN(DEPOSIT_AMOUNT),
            }
            const accountsWithInvalidAccountId = {
                user: attackerWallet.publicKey,
                userTokenAccount: attackerUSDCAccount.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                depositToken: USDC_MINT,
                peer: peerPda,
                enforcedOptions: efOptionsPda,
                oappConfig: oappConfigPda,
                allowedBroker: allowedBrokerPda,
                allowedToken: allowedTokenPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId
            }

          
            await setup.deposit(attackerWallet, solanaVault, paramsWithdrawInvalidAccountId, feeParams, accountsWithInvalidAccountId, depositRemainingAccounts)

        } catch(e) {
            assert.equal(e.error.errorCode.code, "InvalidAccountId")
            console.log("🥷 Attacker failed to deposit with invalid account id")
        }
        
        // try to deposit memecoin
        try {
            console.log("🥷 Attacker tries to deposit MEME coin")
    
            const depositParamsWithMemeCoin = {
                accountId: attackerAccountId,
                brokerHash: woofiProBrokerHash,
                tokenHash: usdcHash,
                userAddress: Array.from(attackerWallet.publicKey.toBytes()),
                tokenAmount: new BN(DEPOSIT_AMOUNT),
            }
            const feeParams = {
                nativeFee: new BN(LZ_FEE),
                lzTokenFee: new BN(0)
            }
            const accountWithMemeCoin ={
                user: attackerWallet.publicKey,
                userTokenAccount: attackerMEMEAccount.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultMEMEAccount.address,
                depositToken: MEME_MINT,
                peer: peerPda,
                enforcedOptions: efOptionsPda,
                oappConfig: oappConfigPda,
                allowedBroker: allowedBrokerPda,
                allowedToken: allowedTokenPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId
            }
            await setup.deposit(attackerWallet, solanaVault, depositParamsWithMemeCoin, feeParams, accountWithMemeCoin, depositRemainingAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("🥷 Attacker failed to deposit MEME coin")
        }


        // try to deposit with invalid broker
        try {
            console.log("🥷 Attacker tries to deposit with unallowed broker")

            const invalidBrokerId = "invalid_broker"
            const invalidBrokerHash = Array.from(Buffer.from(utils.getBrokerHash(invalidBrokerId).slice(2), 'hex'))
            const attackerAccountId = Array.from(Buffer.from(utils.getSolAccountId(attackerWallet.publicKey, invalidBrokerId).slice(2), 'hex'));
            const invalidBrokerPda = utils.getBrokerPdaWithBuf(solanaVault.programId, invalidBrokerHash)

            const setBrokerParams = {
                brokerHash: invalidBrokerHash,
                allowed: false
            }

            const setBrokerAccounts = {
                admin: wallet.publicKey,
                allowedBroker: invalidBrokerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId
            }

            await setup.setBroker(wallet.payer, solanaVault, setBrokerParams, setBrokerAccounts)
            console.log("✅ Set Invalid Broker as not allowed")

            const depositParamsWithInvalidBroker = {
                accountId: attackerAccountId,
                brokerHash: invalidBrokerHash,
                tokenHash: usdcHash,
                userAddress: Array.from(attackerWallet.publicKey.toBytes()),
                tokenAmount: new BN(DEPOSIT_AMOUNT),
            }
            const feeParams = {
                nativeFee: new BN(LZ_FEE),
                lzTokenFee: new BN(0)
            }
            const accountWithInvalidBroker ={
                user: attackerWallet.publicKey,
                userTokenAccount: attackerUSDCAccount.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                depositToken: USDC_MINT,
                peer: peerPda,
                enforcedOptions: efOptionsPda,
                oappConfig: oappConfigPda,
                allowedBroker: invalidBrokerPda,
                allowedToken: allowedTokenPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId
            }
            await setup.deposit(attackerWallet, solanaVault, depositParamsWithInvalidBroker, feeParams, accountWithInvalidBroker, depositRemainingAccounts)
    } catch(e) {
        // console.log(e)
        assert.equal(e.error.errorCode.code, "BrokerNotAllowed")
        console.log("🥷 Attacker failed to deposit with unallowed broker")
    }  
    })

    it('LzReceive tests', async () => {    
        console.log("🚀 Starting lzReceive tests")
        // const noncePda = getNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())
        const guid = Array.from(Keypair.generate().publicKey.toBuffer())
        const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
        const eventAuthorityPda = utils.getEventAuthorityPda()
        const pendingInboundNoncePda = utils.getPendingInboundNoncePda(oappConfigPda, DST_EID, peerAddress)
        const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
        const receiveLibraryConfigPda = utils.getReceiveLibConfigPda(oappConfigPda, DST_EID)
        const defaultReceiveLibraryConfigPda = utils.getDefaultReceiveLibConfigPda(DST_EID)
        const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
        // const msgSender = wallet.publicKey   // placeholder as an OAPP sender

        let nonce, msg, payload, params, accounts

        // ================== Initialize Receive Library ==================

        await setup.initReceiveLibrary(wallet.payer, endpointAdmin, solanaVault, endpointProgram, DST_EID)
        console.log("✅ Initialized Receive Library")

        await setup.initDefaultReceiveLibrary(endpointAdmin, endpointProgram, ulnProgram, DST_EID)
        console.log("✅ Initialized Default Receive Library")

        // ================== Init the Verify for Withdraw Msg ==================
        nonce = 1
        // console.log("nonce", nonce)
        await setup.initVerify(wallet, endpointAdmin, solanaVault, endpointProgram, msgSender, nonce, peerAddress, DST_EID)
     
        // ================== Prepare Withdraw Msg ==================
        const msgType = 1 // Withdraw message type
        const tokenAmountBuffer = Buffer.alloc(8)
        tokenAmountBuffer.writeBigUInt64BE(BigInt(WITHDRAW_AMOUNT))

        const feeBuffer = Buffer.alloc(8)
        feeBuffer.writeBigUInt64BE(BigInt(WITHDRAW_FEE))
        
        const chainIdBuffer = Buffer.alloc(8)
        chainIdBuffer.writeBigUInt64BE(BigInt('1'))

        const withdrawNonceBuffer = Buffer.alloc(8)
        withdrawNonceBuffer.writeBigUInt64BE(BigInt('2'))
        const tokenPda = utils.getTokenPdaWithBuf(solanaVault.programId, usdcHash)
        const brokerPda = utils.getBrokerPdaWithBuf(solanaVault.programId, woofiProBrokerHash)

        const oappConfigPdaData = await solanaVault.account.oAppConfig.fetch(oappConfigPda);
        

        const adminUSDCAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,   // new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
            oappConfigPdaData.admin,
        )

        payload = Buffer.concat([
            // wallet.publicKey.toBuffer()// placeholder for account_id
            wallet.publicKey.toBuffer(),  // sender     
            userWallet.publicKey.toBuffer(),  // receiver
            Buffer.from(woofiProBrokerHash), 
            // Buffer.from(usdcHash), 
            tokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        msg = helper.encodeMessage(msgType, payload)
        console.log("✅ Generated a withdraw message")

        
        // ================== Commit and Verify 1st Withdraw Msg ==================
        
        await setup.commitVerify(wallet, endpointAdmin, solanaVault, endpointProgram, ulnProgram, nonce, msg, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID, guid)

        const peerPda = utils.getPeerPda(solanaVault.programId, oappConfigPda, DST_EID)

        // get initial balance
        prevVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)
        
        await provider.connection.requestAirdrop(attackerWallet.publicKey, 1e9)
        
        // try to frontrun to steal USDC
        try {
            console.log("🥷 Attacker frontruns to steal USDC")
            // const attackerWallet = Keypair.generate();
            // await provider.connection.requestAirdrop(attackerWallet.publicKey, 1e9)

            // create usdc account for attacker
            const attackerDepositWallet = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                wallet.payer,
                USDC_MINT,
                attackerWallet.publicKey,
                true
            )
            // wait for 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
            const params = {
                srcEid: DST_EID,
                sender: Array.from(msgSender.toBytes()),
                nonce: new BN(nonce),
                guid: guid,
                message: msg,
                extraData: Buffer.from([])
            }

            // console.log(attackerWallet.publicKey.toBase58())
            const accountsWithInvalidReceiver = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: USDC_MINT,
                receiver: attackerWallet.publicKey,
                receiverTokenAccount: attackerDepositWallet.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                // adminTokenAccount: adminUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,
            } 
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithInvalidReceiver, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "InvalidReceiver")
            console.log("🥷 Attacker failed to steal USDC")
        }
        
        // try to exectue the lzReceive with memecoin withdraw
        try {
            console.log("🥷 Attacker frontruns to execute withdrawal with memecoin")
           
            prevVaultMEMEBalance = await helper.getTokenBalance(provider.connection, vaultMEMEAccount.address)

            // mint 1000 MEME coin to the vault authority
            await helper.mintTokenTo(
                provider.connection,
                wallet.payer,
                memeMintAuthority,
                MEME_MINT,   // MEME coin
                vaultMEMEAccount.address,
                WITHDRAW_AMOUNT // 1000 MEME coin
            )

            currVaultMEMEBalance = await helper.getTokenBalance(provider.connection, vaultMEMEAccount.address)
            assert.equal(currVaultMEMEBalance, prevVaultMEMEBalance + WITHDRAW_AMOUNT)
            console.log(`🥷 Attacker minted ${WITHDRAW_AMOUNT} MEME to vault authority`)

            const params = {
                srcEid: DST_EID,
                sender: Array.from(msgSender.toBytes()),
                nonce: new BN(nonce),
                guid: guid,
                message: msg,
                extraData: Buffer.from([])
            }
            const accountsWithMemeToken = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: MEME_MINT,
                receiver: userWallet.publicKey,
                receiverTokenAccount: userMEMEAccount.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultMEMEAccount.address,
                // adminTokenAccount: adminUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithMemeToken, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)       
        } catch(e) {
            
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("🥷 Attacker failed to execute withdrawal with meme coin")
        }

        // try to execute the lzReceive USDC with not allowed broker
        try {
            await solanaVault.methods
            .setBroker({
                brokerHash: woofiProBrokerHash,
                allowed: false
            })
            .accounts({
                admin: wallet.publicKey,
                allowedBroker: brokerPda,
                oappConfig: oappConfigPda,
            }).signers([endpointAdmin]).rpc(confirmOptions);
    
            console.log("✅ Set Broker to not allowed")

            console.log("🥷 Attacker tries to execute withdrawal with not allowed broker")
            const params = {
                srcEid: DST_EID,
                sender: Array.from(msgSender.toBytes()),
                nonce: new BN(nonce),
                guid: guid,
                message: msg,
                extraData: Buffer.from([])
            }
            const accountsWithInvalidBroker = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: USDC_MINT,
                receiver: userWallet.publicKey,
                receiverTokenAccount: userUSDCAccount.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                // adminTokenAccount: adminUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithInvalidBroker, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
        } catch(e)
        {   
            // console.log(e)
            assert.equal(e.error.errorCode.code, "BrokerNotAllowed")
            console.log("🥷 Attacker failed to execute withdrawal with not allowed broker")
        }

        await solanaVault.methods
        .setBroker({
            brokerHash: woofiProBrokerHash,
            allowed: true
        })
        .accounts({
            admin: wallet.publicKey,
            allowedBroker: brokerPda,
            oappConfig: oappConfigPda,
        }).signers([endpointAdmin]).rpc(confirmOptions);

        console.log("✅ Set Broker allowed")

        // try to execute the lzReceive USDC with not allowed token
        try {
            await solanaVault.methods
            .setToken({
                mintAccount: USDC_MINT,
                tokenHash: usdcHash,
                allowed: false
            })
            .accounts({
                admin: wallet.publicKey,
                allowedToken: tokenPda,
                oappConfig: oappConfigPda,
                mintAccount: USDC_MINT
            }).signers([endpointAdmin]).rpc(confirmOptions);
    
            console.log("✅ Set Token to not allowed")

            console.log("🥷 Attacker tries to execute withdrawal with not allowed token")
            const params = {
                srcEid: DST_EID,
                sender: Array.from(msgSender.toBytes()),
                nonce: new BN(nonce),
                guid: guid,
                message: msg,
                extraData: Buffer.from([])
            }
            const accountsWithUnlistedToken = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: USDC_MINT,
                receiver: userWallet.publicKey,
                receiverTokenAccount: userUSDCAccount.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithUnlistedToken, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
        } catch(e)
        {   
            // console.log(e)
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("🥷 Attacker failed to execute withdrawal with not allowed token")
        }

        await solanaVault.methods
            .setToken({
                mintAccount: USDC_MINT,
                tokenHash: usdcHash,
                allowed: true
            })
            .accounts({
                admin: wallet.publicKey,
                allowedToken: tokenPda,
                oappConfig: oappConfigPda,
                mintAccount: USDC_MINT
            }).signers([endpointAdmin]).rpc(confirmOptions);

        console.log("✅ Set token allowed")

       
        prevVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)
        // execute the lzReceive instruction successfully
        

        userUSDCAccount = await getAccount(
            provider.connection,
            userUSDCAccount.address
        )
        // console.log(userUSDCAccount)
        const newOwner = Keypair.generate()
        await provider.connection.requestAirdrop(attackerWallet.publicKey, 1e9)

        // Transfer ownership of the user ata to the another account
        await setAuthority(
            provider.connection,
            userWallet,
            userUSDCAccount.address,
            userWallet,
            2,
            newOwner.publicKey,  
        )
        console.log("✅ Transferred ownership of USDC ATA")


       params = {
            srcEid: DST_EID,
            sender: Array.from(msgSender.toBytes()),
            nonce: new BN(nonce),
            guid: guid,
            message: msg,
            extraData: Buffer.from([])
        }
        accounts = {
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            peer: peerPda,
            brokerPda: brokerPda,
            tokenPda: tokenPda,
            tokenMint: USDC_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userUSDCAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultUSDCAccount.address,
            // adminTokenAccount: adminUSDCAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        await setup.lzReceive(wallet.payer, solanaVault, endpointProgram, ulnProgram, nonce, params, accounts, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
      

        // Check balance after lzReceive
        currVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(prevVaultUSDCBalance - currVaultUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        currUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)
        assert.equal(currUserUSDCBalance - prevUserUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)
        console.log("✅ Executed lzReceive instruction to withdraw USDC successfully")

        nonce = 2
        await setup.initVerify(wallet, endpointAdmin, solanaVault, endpointProgram, msgSender, nonce, peerAddress, DST_EID)
        await setup.commitVerify(wallet, endpointAdmin, solanaVault, endpointProgram, ulnProgram, nonce, msg, msgSender, peerAddress, DST_EID, SOLANA_EID, guid)
    
        await freezeAccount(
            provider.connection,
            wallet.payer,
            userUSDCAccount.address,
            USDC_MINT,
            usdcMintAuthority,
        )
        
        console.log("✅ Frozen USDC ATA")

        prevVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)

        params = {
            srcEid: DST_EID,
            sender: Array.from(msgSender.toBytes()),
            nonce: new BN(nonce),
            guid: guid,
            message: msg,
            extraData: Buffer.from([])
        }
        accounts = {
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            peer: peerPda,
            brokerPda: brokerPda,
            tokenPda: tokenPda,
            tokenMint: USDC_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userUSDCAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultUSDCAccount.address,
            // adminTokenAccount: adminUSDCAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
        }
        await setup.lzReceive(wallet.payer, solanaVault, endpointProgram, ulnProgram, nonce, params, accounts, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
     
        currVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(prevVaultUSDCBalance - currVaultUSDCBalance, 0)
        assert.equal(currVaultUSDCBalance, WITHDRAW_FEE)

        currUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)
        assert.equal(currUserUSDCBalance - prevUserUSDCBalance, 0)
        console.log(`✅ Executed lzReceive instruction to withdraw USDC successfully with frozen ATA`)

        nonce = 3
        await setup.initVerify(wallet, endpointAdmin, solanaVault, endpointProgram, msgSender, nonce, peerAddress, DST_EID)
        await setup.commitVerify(wallet, endpointAdmin, solanaVault, endpointProgram, ulnProgram, nonce, msg, msgSender, peerAddress, DST_EID, SOLANA_EID, guid)
        
        await thawAccount(
            provider.connection,
            wallet.payer,
            userUSDCAccount.address,
            USDC_MINT,
            usdcMintAuthority
        )

        const newOwnerUSDCWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            newOwner.publicKey,
            // true
        )

        userUSDCAccount = await getAccount(
            provider.connection,
            userUSDCAccount.address
        )

        await transfer(
            provider.connection,
            wallet.payer,
            userUSDCAccount.address,
            newOwnerUSDCWallet.address,
            newOwner,
            userUSDCAccount.amount
        )

        console.log("✅ Transferred all USDC out of ATA")

        await closeAccount(
            provider.connection,
            wallet.payer,
            userUSDCAccount.address,
            newOwner.publicKey,
            newOwner,  
        )

        
        params = {
            srcEid: DST_EID,
            sender: Array.from(msgSender.toBytes()),
            nonce: new BN(nonce),
            guid: guid,
            message: msg,
            extraData: Buffer.from([])
        }
        accounts = {
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            peer: peerPda,
            brokerPda: brokerPda,
            tokenPda: tokenPda,
            tokenMint: USDC_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userUSDCAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultUSDCAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        }

        await helper.mintTokenTo(provider.connection, wallet.payer, usdcMintAuthority, USDC_MINT, vaultUSDCAccount.address, WITHDRAW_AMOUNT)

        prevVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        let prevAdminBalance = await helper.getTokenBalance(provider.connection, adminUSDCAccount.address)
        
        await setup.lzReceive(wallet.payer, solanaVault, endpointProgram, ulnProgram, nonce, params, accounts, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
       
        currVaultUSDCBalance = await helper.getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(prevVaultUSDCBalance - currVaultUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        currUserUSDCBalance = await helper.getTokenBalance(provider.connection, userUSDCAccount.address)
        assert.equal(currUserUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        console.log("✅ Executed lzReceive instruction to create empty ATA and withdraw USDC")
    })

    it('Quote tests', async () => {
        console.log("🚀 Starting quote tests")
        const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
        const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
        const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
        const sendLibraryConfigPda = utils.getSendLibConfigPda(oappConfigPda, DST_EID)
        const defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(DST_EID)
        const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
        const efOptionsPda = utils.getEnforcedOptionsPda(solanaVault.programId, oappConfigPda, DST_EID)    
        const eventAuthorityPda = utils.getEventAuthorityPda()
        const noncePda = utils.getNoncePda(oappConfigPda, DST_EID, peerAddress)
        const pendingInboundNoncePda = utils.getPendingInboundNoncePda(oappConfigPda, DST_EID, peerAddress)

        const peerPda = utils.getPeerPda(solanaVault.programId, oappConfigPda, DST_EID)
        // const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        const woofiProBrokerHash = usdcHash;
        const {lzTokenFee, nativeFee} = await solanaVault.methods
            .oappQuote({
                accountId: Array.from(wallet.publicKey.toBytes()),
                brokerHash: woofiProBrokerHash,
                tokenHash: usdcHash,
                userAddress: Array.from(wallet.publicKey.toBytes()),
                tokenAmount: new BN(1e9),
            })
            .accounts({
                oappConfig: oappConfigPda,
                peer: peerPda,
                enforcedOptions: efOptionsPda,
                vaultAuthority: vaultAuthorityPda,
            })
            .remainingAccounts([
                {
                    pubkey: endpointProgram.programId,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: ulnProgram.programId,  // send_library_program
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: sendLibraryConfigPda, // send_library_config
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: defaultSendLibraryConfigPda, // default_send_library_config
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: messageLibInfoPda, // send_library_info
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: endpointPda, // endpoint settings
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: noncePda, // nonce
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: eventAuthorityPda,
                    isWritable: false,
                    isSigner: false,
                },
                {
                    pubkey: endpointProgram.programId,
                    isWritable: false,
                    isSigner: false,
                },
            ])
            .view()
        assert.isTrue(nativeFee.eq(new BN(1000)))
        assert.isTrue(lzTokenFee.eq(new BN(0)))
        console.log("✅ Executed oapp quote")
    })
})