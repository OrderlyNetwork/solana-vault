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
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  createSyncNativeInstruction
} from '@solana/spl-token'
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { assert } from 'chai'
import endpointIdl from './idl/endpoint.json'
import { MainnetV2EndpointId } from '@layerzerolabs/lz-definitions'
import { initOapp, setVault, confirmOptions, setPeer, setEnforcedOptions, initEndpoint, registerLibrary, initSendLibrary, initDefaultSendLibrary, initUln, initNonce } from './setup'
import * as utils from '../scripts/utils'
import * as setup from './setup'
import * as constants from '../scripts/constants'


describe('Test OAPP messaging', function() {
    console.log("Messaging test")
    const { provider, wallet, endpointProgram, ulnProgram, solanaVault } = helper.prepareEnviroment()

    const ORDERLY_EID = MainnetV2EndpointId.ORDERLY_V2_MAINNET
    const DST_EID = ORDERLY_EID
    const SOLANA_EID = MainnetV2EndpointId.SOLANA_V2_MAINNET
    anchor.setProvider(provider)
  
    const usdcMintAuthority = wallet.payer
    const usdtMintAuthority = wallet.payer
    const userWallet = Keypair.generate()
    const attackerWallet = Keypair.generate();
    const endpointAdmin = wallet.payer
    let USDC_MINT: PublicKey
    let USDT_MINT: PublicKey
    const DEPOSIT_AMOUNT = 1e9;    // 1000 USDC
    const WITHDRAW_AMOUNT = 1e9;   // 1000 USDC
    const WITHDRAW_FEE = 1e6;      // 1 USDC
    const DEPOSIT_SOL_AMOUNT = 1e7;    // 0.01 SOL
    const WITHDRAW_SOL_AMOUNT = DEPOSIT_SOL_AMOUNT;    // 0.01 SOL
    const LZ_FEE = 1000;
    let oappConfigPda: PublicKey
    let userUSDCAccount: Account
    let userUSDTAccount: Account
    let userWSOLAccount: Account
    let vaultUSDCAccount: Account
    let vaultUSDTAccount: Account
    let vaultWSOLAccount: Account
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
    let currVaultUSDTBalance
    let prevVaultUSDTBalance
    let currVaultSOLBalance
    let prevVaultSOLBalance
    let currUserUSDCBalance
    let prevUserUSDCBalance
    let currUserUSDTBalance
    let prevUserUSDTBalance
    let currUserSOLBalance
    let prevUserSOLBalance
    let currVaultWSOLAccountBalance
    let prevVaultWSOLAccountBalance
    let currUserWSOLAccountBalance
    let prevUserWSOLAccountBalance
    
    let currVaultMEMEBalance
    let prevVaultMEMEBalance
    let currUserMemeBalance
    let prevUserMemeBalance   
    const memeMintAuthority = Keypair.generate()
    const usdcSymbol = helper.USDC_SYMBOL
    const wsolSymbol = helper.WSOL_SYMBOL
    const usdtSymbol = helper.USDT_SYMBOL
    const woofiProBrokerId = helper.WOOFI_PRO_BROKER_ID
    const usdcHash = helper.getTokenHash(usdcSymbol)
    const usdtHash = helper.getTokenHash(usdtSymbol)
    const wsolHash = helper.getTokenHash(wsolSymbol)
    const solTokenHash = helper.getTokenHash(helper.SOL_SYMBOL)
    const woofiProBrokerHash = helper.getBrokerHash(woofiProBrokerId)
    const tokenManagerRoleHash = helper.getManagerRoleHash(constants.TOKEN_MANAGER_ROLE)
    const tokenManagerRolePda = utils.getManagerRolePdaWithBuf(solanaVault.programId, tokenManagerRoleHash, wallet.publicKey)

    const peerAddress = helper.PEER_ADDRESS
    const msgSender = new PublicKey(peerAddress)
    before("Preparing for tests", async () => {
        console.log("Start messaging test")
        // deploy a USDC mint
        USDC_MINT = helper.USDC_KEY.publicKey
        USDT_MINT = helper.USDT_KEY.publicKey

        await provider.connection.requestAirdrop(userWallet.publicKey, 1e9)
        // Setup Wallets
        userUSDCAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            userWallet.publicKey
        )
        userUSDTAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDT_MINT,
            userWallet.publicKey
        )
        userWSOLAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            NATIVE_MINT,
            userWallet.publicKey
        )
        vaultUSDCAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            vaultAuthorityPda,
            true                // prevent TokenOwnerOffCurveError,
        )
        vaultUSDTAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDT_MINT,
            vaultAuthorityPda,
            true                // prevent TokenOwnerOffCurveError,
        )
        vaultWSOLAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            NATIVE_MINT,
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

         
        let setTokenParams = {
            tokenManagerRole: tokenManagerRoleHash,
            mintAccount: USDC_MINT,
            tokenHash: usdcHash,
            allowed: true
        }
        
        let setTokenAccounts = {
            tokenManager: wallet.publicKey,
            allowedToken: allowedTokenPda,
            managerRole: tokenManagerRolePda,
            mintAccount: USDC_MINT,
            systemProgram: SystemProgram.programId
        }

        await setup.setToken(wallet.payer, solanaVault, setTokenParams, setTokenAccounts)
        console.log("✅ Set USDC Token")

        const allowedBrokerPda = utils.getBrokerPdaWithBuf(solanaVault.programId, woofiProBrokerHash)
        const brokerManagerRoleHash = helper.getManagerRoleHash(constants.BROKER_MANAGER_ROLE)
        const brokerManagerRolePda = utils.getManagerRolePdaWithBuf(solanaVault.programId, brokerManagerRoleHash, wallet.publicKey)
        let setBrokerParams = {
            brokerManagerRole: brokerManagerRoleHash,
            brokerHash: woofiProBrokerHash,
            allowed: true
        }

        let setBrokerAccounts = {
            brokerManager: wallet.publicKey,
            allowedBroker: allowedBrokerPda,
            managerRole: brokerManagerRolePda,
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

        let depositParams = {
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

        let accounts = {
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
            
            // update to invalid account id
            depositParams.accountId = invalidAccountId
            depositParams.userAddress = Array.from(attackerWallet.publicKey.toBytes())

            // update to attacker wallet
            accounts.user = attackerWallet.publicKey
            accounts.userTokenAccount = attackerUSDCAccount.address
          
            await setup.deposit(attackerWallet, solanaVault, depositParams, feeParams, accounts, depositRemainingAccounts)
            console.log("❌ Attacker successfully executed deposit with invalid account id")
        } catch(e) {
            assert.equal(e.error.errorCode.code, "InvalidAccountId")
            console.log("👌 Attacker failed to deposit with invalid account id")
        }
        
        // try to deposit memecoin
        try {
            console.log("🥷 Attacker tries to deposit MEME coin")
            
            // recover to attacker account id
            depositParams.accountId = attackerAccountId

            // update to meme token
            accounts.userTokenAccount = attackerMEMEAccount.address
            accounts.vaultTokenAccount = vaultMEMEAccount.address
            accounts.depositToken = MEME_MINT

            await setup.deposit(attackerWallet, solanaVault, depositParams, feeParams, accounts, depositRemainingAccounts)
            console.log("❌ Attacker successfully executed deposit with MEME coin")
        } catch(e) {
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("👌 Attacker failed to deposit MEME coin")
        }


        // try to deposit with invalid broker
        try {
            console.log("🥷 Attacker tries to deposit with unallowed broker")

            const invalidBrokerId = "invalid_broker"
            const invalidBrokerHash = Array.from(Buffer.from(utils.getBrokerHash(invalidBrokerId).slice(2), 'hex'))
            const attackerAccountId = Array.from(Buffer.from(utils.getSolAccountId(attackerWallet.publicKey, invalidBrokerId).slice(2), 'hex'));
            const invalidBrokerPda = utils.getBrokerPdaWithBuf(solanaVault.programId, invalidBrokerHash)

            setBrokerParams.brokerHash = invalidBrokerHash
            setBrokerParams.allowed = false

            setBrokerAccounts.allowedBroker = invalidBrokerPda

            await setup.setBroker(wallet.payer, solanaVault, setBrokerParams, setBrokerAccounts)
            console.log("✅ Set Invalid Broker as not allowed")

            depositParams.brokerHash = invalidBrokerHash

            // update to invalid broker pda
            accounts.allowedBroker = invalidBrokerPda
            // recover to usdc token
            accounts.userTokenAccount = attackerUSDCAccount.address
            accounts.vaultTokenAccount = vaultUSDCAccount.address
            accounts.depositToken = USDC_MINT

            await setup.deposit(attackerWallet, solanaVault, depositParams , feeParams, accounts, depositRemainingAccounts)
            console.log("❌ Attacker successfully executed deposit with not allowed broker")
    } catch(e) {
        // console.log(e)
        assert.equal(e.error.errorCode.code, "BrokerNotAllowed")
        console.log("👌 Attacker failed to deposit with not allowed broker")
    }  

    console.log("🚀 Starting deposit USDT tests")

    await helper.mintTokenTo(
        provider.connection,
        wallet.payer,
        usdtMintAuthority,
        USDT_MINT,
        userUSDTAccount.address,
        DEPOSIT_AMOUNT // 1000 USDT
    )
    console.log(`✅ Minted ${DEPOSIT_AMOUNT} USDT to user deposit wallet`)

    depositParams.tokenHash = usdtHash
    depositParams.brokerHash = woofiProBrokerHash
    depositParams.userAddress = Array.from(userWallet.publicKey.toBytes())
    depositParams.tokenAmount = new BN(DEPOSIT_AMOUNT)
    depositParams.accountId = solAccountId

    accounts.user = userWallet.publicKey
    accounts.userTokenAccount = userUSDTAccount.address
    accounts.vaultTokenAccount = vaultUSDTAccount.address
    accounts.depositToken = USDT_MINT
    accounts.allowedToken = utils.getTokenPdaWithBuf(solanaVault.programId, usdtHash)
    accounts.allowedBroker = allowedBrokerPda

    prevUserUSDTBalance = await helper.getTokenBalance(provider.connection, userUSDTAccount.address)
    prevVaultUSDTBalance = await helper.getTokenBalance(provider.connection, vaultUSDTAccount.address)

    assert.equal(prevUserUSDTBalance, DEPOSIT_AMOUNT)
    assert.equal(prevVaultUSDTBalance, 0)

    await setup.deposit(userWallet, solanaVault, depositParams, feeParams, accounts, depositRemainingAccounts)

    currUserUSDTBalance = await helper.getTokenBalance(provider.connection, userUSDTAccount.address)
    currVaultUSDTBalance = await helper.getTokenBalance(provider.connection, vaultUSDTAccount.address)

    assert.equal(currUserUSDTBalance, prevUserUSDTBalance - DEPOSIT_AMOUNT)
    assert.equal(currVaultUSDTBalance, prevVaultUSDTBalance + DEPOSIT_AMOUNT)

    console.log("✅ Check account states after deposit")
    console.log("✅ Executed deposit USDT")

    console.log("🚀 Starting deposit WSOL tests")
        // transform SOL to WSOL
        let tx = new Transaction().add(
            // transfer SOL
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: userWSOLAccount.address,
              lamports: DEPOSIT_AMOUNT
            }),
            // sync wrapped SOL balance
            createSyncNativeInstruction(userWSOLAccount.address)
          );
          
        await sendAndConfirmTransaction(provider.connection, tx, [wallet.payer])

        let currUserWSOLAccountBalance = await helper.getTokenBalance(provider.connection, userWSOLAccount.address)
        assert.equal(currUserWSOLAccountBalance, DEPOSIT_AMOUNT)

        console.log("✅ Transfer SOL to WSOL")

        
        depositParams.tokenHash = wsolHash
        // depositParams.brokerHash = woofiProBrokerHash
        
        accounts.user = userWallet.publicKey
        accounts.userTokenAccount = userWSOLAccount.address
        accounts.vaultTokenAccount = vaultWSOLAccount.address
        accounts.depositToken = NATIVE_MINT
        accounts.allowedToken = utils.getTokenPdaWithBuf(solanaVault.programId, wsolHash)
        accounts.allowedBroker = allowedBrokerPda

        await setup.deposit(userWallet, solanaVault, depositParams, feeParams, accounts, depositRemainingAccounts)

        currUserWSOLAccountBalance = await helper.getTokenBalance(provider.connection, userWSOLAccount.address)
        assert.equal(currUserWSOLAccountBalance, 0)

        let currVaultWSOLAccountBalance = await helper.getTokenBalance(provider.connection, vaultWSOLAccount.address)
        assert.equal(currVaultWSOLAccountBalance, DEPOSIT_AMOUNT)
        
        console.log("✅ Check account states after deposit")
        console.log("✅ Executed deposit WSOL")

        console.log("🚀 Starting deposit SOL tests")


        depositParams.tokenHash = solTokenHash
        depositParams.tokenAmount = new BN(DEPOSIT_SOL_AMOUNT)
        const allowedSolTokenPda = utils.getTokenPdaWithBuf(solanaVault.programId, solTokenHash)
        const solVaultPda = utils.getSolVaultPda(solanaVault.programId)

        let depositSolAccounts = {
            user: userWallet.publicKey,
            solVault: solVaultPda,
            vaultAuthority: vaultAuthorityPda,
            peer: peerPda,
            enforcedOptions: efOptionsPda,
            oappConfig: oappConfigPda,
            allowedBroker: allowedBrokerPda,
            allowedToken: allowedSolTokenPda,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        prevUserSOLBalance = await provider.connection.getBalance(userWallet.publicKey)
        prevVaultSOLBalance = await provider.connection.getBalance(solVaultPda)

        console.log("prevVaultSOLBalance", prevVaultSOLBalance)
      
        await setup.depositSol(userWallet, solanaVault, depositParams, feeParams, depositSolAccounts, depositRemainingAccounts)

        currUserSOLBalance = await provider.connection.getBalance(userWallet.publicKey)
        currVaultSOLBalance = await provider.connection.getBalance(solVaultPda)

        console.log("currVaultSOLBalance", currVaultSOLBalance)

        assert.equal(currUserSOLBalance, prevUserSOLBalance - DEPOSIT_SOL_AMOUNT)
        assert.equal(currVaultSOLBalance, prevVaultSOLBalance + DEPOSIT_SOL_AMOUNT)

        console.log("✅ Check account states after deposit SOL")
        console.log("✅ Executed deposit SOL")


    })

    it('LzReceive tests', async () => {    
        console.log("🚀 Starting lzReceive tests")
        // const noncePda = getNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())
        const guid = Array.from(Keypair.generate().publicKey.toBuffer())
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

        const tokenIndexBuffer = Buffer.alloc(1)
        tokenIndexBuffer.writeUint8(constants.TOKEN_INDEX.USDC)

        const withdrawNonceBuffer = Buffer.alloc(8)
        withdrawNonceBuffer.writeBigUInt64BE(BigInt('2'))
        const withdrawUsdcPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.USDC)
        const withdrawUsdcPdaData = await solanaVault.account.withdrawToken.fetch(withdrawUsdcPda)
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
            tokenIndexBuffer,
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
        const solVaultPda = utils.getSolVaultPda(solanaVault.programId)

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
                withdrawTokenPda: withdrawUsdcPda,
                tokenMint: USDC_MINT,
                receiver: attackerWallet.publicKey,
                receiverTokenAccount: attackerDepositWallet.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                solVault: solVaultPda,
                tokenProgram: TOKEN_PROGRAM_ID,
            } 
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithInvalidReceiver, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
            console.log("❌ Attacker successfully executed withdrawal with invalid receiver")
        } catch(e) {
            console.log(e)
            assert.equal(e.error.errorCode.code, "InvalidReceiver")
            console.log("👌 Attacker failed to steal USDC")
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
                withdrawTokenPda: withdrawUsdcPda,
                tokenMint: MEME_MINT,
                receiver: userWallet.publicKey,
                receiverTokenAccount: userMEMEAccount.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultMEMEAccount.address,
                solVault: solVaultPda,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithMemeToken, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)       
            console.log("❌ Attacker successfully executed withdrawal with meme coin")
        } catch(e) {
            
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("👌 Attacker failed to execute withdrawal with meme coin")
        }

        // try to execute the lzReceive USDC with not allowed broker
        const brokerManagerRoleHash = helper.getManagerRoleHash(constants.BROKER_MANAGER_ROLE)
        const brokerManagerRolePda = utils.getManagerRolePdaWithBuf(solanaVault.programId, brokerManagerRoleHash, wallet.publicKey)
        let setBrokerParams, setBrokerAccounts
        try {

            setBrokerParams = {
                brokerManagerRole: brokerManagerRoleHash,
                brokerHash: woofiProBrokerHash,
                allowed: false
            }
            setBrokerAccounts = {
                brokerManager: wallet.publicKey,
                allowedBroker: brokerPda,
                managerRole: brokerManagerRolePda,
                systemProgram: SystemProgram.programId
            }

            await setup.setBroker(wallet.payer, solanaVault, setBrokerParams, setBrokerAccounts)
    
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
                withdrawTokenPda: withdrawUsdcPda,
                tokenMint: USDC_MINT,
                receiver: userWallet.publicKey,
                receiverTokenAccount: userUSDCAccount.address,
                vaultAuthority: vaultAuthorityPda,
                solVault: solVaultPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithInvalidBroker, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
            console.log("❌ Attacker successfully executed withdrawal with not allowed broker")
        } catch(e)
        {   
            // console.log(e)
            assert.equal(e.error.errorCode.code, "BrokerNotAllowed")
            console.log("👌 Attacker failed to execute withdrawal with not allowed broker")
        }

        setBrokerParams.allowed = true
        await setup.setBroker(wallet.payer, solanaVault, setBrokerParams, setBrokerAccounts)

        console.log("✅ Set Broker allowed")

        // try to execute the lzReceive USDC with not allowed token
        const tokenManagerRoleHash = helper.getManagerRoleHash(constants.TOKEN_MANAGER_ROLE)
        const tokenManagerRolePda = utils.getManagerRolePdaWithBuf(solanaVault.programId, tokenManagerRoleHash, wallet.publicKey)
        let setWithdrawTokenParams, setWithdrawTokenAccounts
        try {

            setWithdrawTokenParams = {
                tokenManagerRole: tokenManagerRoleHash,
                mintAccount: USDC_MINT,
                tokenHash: usdcHash,
                tokenIndex: constants.TOKEN_INDEX.USDC,
                allowed: false
            }
            setWithdrawTokenAccounts = {
                tokenManager: wallet.publicKey,
                withdrawToken: withdrawUsdcPda,
                managerRole: tokenManagerRolePda,
                mintAccount: USDC_MINT,
                systemProgram: SystemProgram.programId
            }

            await setup.setWithdrawToken(wallet.payer, solanaVault, setWithdrawTokenParams, setWithdrawTokenAccounts)
    
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
                withdrawTokenPda: withdrawUsdcPda,
                tokenMint: USDC_MINT,
                receiver: userWallet.publicKey,
                receiverTokenAccount: userUSDCAccount.address,
                vaultAuthority: vaultAuthorityPda,
                solVault: solVaultPda,
                vaultTokenAccount: vaultUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await setup.lzReceive(attackerWallet, solanaVault, endpointProgram, ulnProgram, nonce, params, accountsWithUnlistedToken, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
            console.log("❌ Attacker successfully executed withdrawal with not allowed token")
        } catch(e)
        {   
            // console.log(e)
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("👌 Attacker failed to execute withdrawal with not allowed token")
        }

        setWithdrawTokenParams.allowed = true
        await setup.setWithdrawToken(wallet.payer, solanaVault, setWithdrawTokenParams, setWithdrawTokenAccounts)
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
            withdrawTokenPda: withdrawUsdcPda,
            tokenMint: USDC_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userUSDCAccount.address,
            vaultAuthority: vaultAuthorityPda,
            solVault: solVaultPda,
            vaultTokenAccount: vaultUSDCAccount.address,
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
            withdrawTokenPda: withdrawUsdcPda,
            tokenMint: USDC_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userUSDCAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultUSDCAccount.address,
            solVault: solVaultPda,
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
            withdrawTokenPda: withdrawUsdcPda,
            tokenMint: USDC_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userUSDCAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultUSDCAccount.address,
            solVault: solVaultPda,
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

        nonce = 4

        const usdtTokenIndexBuffer = Buffer.alloc(1)
        usdtTokenIndexBuffer.writeUint8(constants.TOKEN_INDEX.USDT)

        payload = Buffer.concat([
            // wallet.publicKey.toBuffer()// placeholder for account_id
            wallet.publicKey.toBuffer(),  // sender     
            userWallet.publicKey.toBuffer(),  // receiver
            Buffer.from(woofiProBrokerHash), 
            usdtTokenIndexBuffer,
            tokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        msg = helper.encodeMessage(msgType, payload)
        console.log("✅ Generated a withdraw message for USDT")

        await setup.initVerify(wallet, endpointAdmin, solanaVault, endpointProgram, msgSender, nonce, peerAddress, DST_EID)
        await setup.commitVerify(wallet, endpointAdmin, solanaVault, endpointProgram, ulnProgram, nonce, msg, msgSender, peerAddress, DST_EID, SOLANA_EID, guid)

        params = {
            srcEid: DST_EID,
            sender: Array.from(msgSender.toBytes()),
            nonce: new BN(nonce),
            guid: guid,
            message: msg,
            extraData: Buffer.from([])
        }

        const withdrawUsdtPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.USDT)

        accounts = {
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            peer: peerPda,
            brokerPda: brokerPda,
            withdrawTokenPda: withdrawUsdtPda,
            tokenMint: USDT_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userUSDTAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultUSDTAccount.address,
            solVault: solVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        prevVaultUSDTBalance = await helper.getTokenBalance(provider.connection, vaultUSDTAccount.address)
        prevUserUSDTBalance = await helper.getTokenBalance(provider.connection, userUSDTAccount.address)

        await setup.lzReceive(wallet.payer, solanaVault, endpointProgram, ulnProgram, nonce, params, accounts, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
      

        // Check balance after lzReceive
        currVaultUSDTBalance = await helper.getTokenBalance(provider.connection, vaultUSDTAccount.address)
        assert.equal(prevVaultUSDTBalance - currVaultUSDTBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        currUserUSDTBalance = await helper.getTokenBalance(provider.connection, userUSDTAccount.address)
        assert.equal(currUserUSDTBalance - prevUserUSDTBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)
        console.log("✅ Executed lzReceive instruction to withdraw USDT successfully")


        nonce = 5

        const wsolTokenIndexBuffer = Buffer.alloc(1)
        wsolTokenIndexBuffer.writeUint8(constants.TOKEN_INDEX.WSOL)

        payload = Buffer.concat([
            // wallet.publicKey.toBuffer()// placeholder for account_id
            wallet.publicKey.toBuffer(),  // sender     
            userWallet.publicKey.toBuffer(),  // receiver
            Buffer.from(woofiProBrokerHash), 
            wsolTokenIndexBuffer,
            tokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        msg = helper.encodeMessage(msgType, payload)
        console.log("✅ Generated a withdraw message for WSOL")

        await setup.initVerify(wallet, endpointAdmin, solanaVault, endpointProgram, msgSender, nonce, peerAddress, DST_EID)
        await setup.commitVerify(wallet, endpointAdmin, solanaVault, endpointProgram, ulnProgram, nonce, msg, msgSender, peerAddress, DST_EID, SOLANA_EID, guid)

        params = {
            srcEid: DST_EID,
            sender: Array.from(msgSender.toBytes()),
            nonce: new BN(nonce),
            guid: guid,
            message: msg,
            extraData: Buffer.from([])
        }

        const withdrawWsolPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.WSOL)

        accounts = {
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            peer: peerPda,
            brokerPda: brokerPda,
            withdrawTokenPda: withdrawWsolPda,
            tokenMint: NATIVE_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userWSOLAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultWSOLAccount.address,
            solVault: solVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        prevVaultWSOLAccountBalance = await helper.getTokenBalance(provider.connection, vaultWSOLAccount.address)
        prevUserWSOLAccountBalance = await helper.getTokenBalance(provider.connection, userWSOLAccount.address)

        await setup.lzReceive(wallet.payer, solanaVault, endpointProgram, ulnProgram, nonce, params, accounts, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)
      

        // Check balance after lzReceive
        currVaultWSOLAccountBalance = await helper.getTokenBalance(provider.connection, vaultWSOLAccount.address)
        assert.equal(prevVaultWSOLAccountBalance - currVaultWSOLAccountBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        currUserWSOLAccountBalance = await helper.getTokenBalance(provider.connection, userWSOLAccount.address)
        assert.equal(currUserWSOLAccountBalance - prevUserWSOLAccountBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)
        console.log("✅ Executed lzReceive instruction to withdraw WSOL successfully")

        nonce = 6
        const solTokenIndexBuffer = Buffer.alloc(1)
        solTokenIndexBuffer.writeUint8(constants.TOKEN_INDEX.SOL)

        const solTokenAmountBuffer = Buffer.alloc(8)
        solTokenAmountBuffer.writeBigUInt64BE(BigInt(WITHDRAW_SOL_AMOUNT))

        payload = Buffer.concat([
            // wallet.publicKey.toBuffer()// placeholder for account_id
            wallet.publicKey.toBuffer(),  // sender     
            userWallet.publicKey.toBuffer(),  // receiver
            Buffer.from(woofiProBrokerHash), 
            solTokenIndexBuffer,
            solTokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        msg = helper.encodeMessage(msgType, payload)
        console.log("✅ Generated a withdraw message for SOL")

        await setup.initVerify(wallet, endpointAdmin, solanaVault, endpointProgram, msgSender, nonce, peerAddress, DST_EID)
        await setup.commitVerify(wallet, endpointAdmin, solanaVault, endpointProgram, ulnProgram, nonce, msg, msgSender, peerAddress, DST_EID, SOLANA_EID, guid)

        params = {
            srcEid: DST_EID,
            sender: Array.from(msgSender.toBytes()),
            nonce: new BN(nonce),
            guid: guid,
            message: msg,
            extraData: Buffer.from([])
        }

        const withdrawSolPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.SOL)

        accounts = {
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            peer: peerPda,
            brokerPda: brokerPda,
            withdrawTokenPda: withdrawSolPda,
            tokenMint: NATIVE_MINT,
            receiver: userWallet.publicKey,
            receiverTokenAccount: userWSOLAccount.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultWSOLAccount.address,
            solVault: solVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        
        prevUserSOLBalance = await provider.connection.getBalance(userWallet.publicKey)
        prevVaultSOLBalance = await provider.connection.getBalance(solVaultPda)

        console.log("prevVaultSOLBalance", prevVaultSOLBalance)

        await setup.lzReceive(wallet.payer, solanaVault, endpointProgram, ulnProgram, nonce, params, accounts, msgSender, peerAddress, ORDERLY_EID, SOLANA_EID)

        currVaultSOLBalance = await provider.connection.getBalance(solVaultPda)
        currUserSOLBalance = await provider.connection.getBalance(userWallet.publicKey)

        console.log("currVaultSOLBalance", currVaultSOLBalance)

        assert.equal(currUserSOLBalance - prevUserSOLBalance, WITHDRAW_SOL_AMOUNT - WITHDRAW_FEE)
        assert.equal(prevVaultSOLBalance - currVaultSOLBalance, WITHDRAW_SOL_AMOUNT - WITHDRAW_FEE)

        console.log("✅ Executed lzReceive instruction to withdraw SOL successfully")
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