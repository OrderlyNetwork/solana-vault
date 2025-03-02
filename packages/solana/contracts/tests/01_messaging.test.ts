import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from './types/endpoint'
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
import { 
    getEndpointSettingPda, 
    getPeerPda, 
    getVaultAuthorityPda, 
    getEnforcedOptionsPda, 
    getMessageLibPda, 
    getMessageLibInfoPda, 
    getOAppRegistryPda,
    getOAppConfigPda,
    getSendLibConfigPda,
    getDefaultSendLibConfigPda,
    getEventAuthorityPda,
    getPayloadHashPda,
    getNoncePda,
    getPendingInboundNoncePda,
    getReceiveLibConfigPda,
    getDefaultReceiveLibConfigPda,
    getTokenPdaWithBuf,
    getBrokerPdaWithBuf,
} from '../scripts/utils'
import { MainnetV2EndpointId } from '@layerzerolabs/lz-definitions'
import { initOapp, setVault, confirmOptions } from './setup'
import * as utils from '../scripts/utils'

const LAYERZERO_ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
const ETHEREUM_EID = MainnetV2EndpointId.ETHEREUM_V2_MAINNET
const SOLANA_EID = MainnetV2EndpointId.SOLANA_V2_MAINNET
async function getTokenBalance(
    connection: Connection,
    tokenAccount: PublicKey
): Promise<number> {
    const account = await getAccount(connection, tokenAccount)
    return Number(account.amount)
}

function encodeMessage(msgType: number, payload: Buffer): Buffer {
    const encoded = Buffer.alloc(1 + payload.length)
    encoded.writeUIntBE(msgType, 0, 1)
    payload.copy(encoded, 1)
    return encoded
}

async function mintTokenTo(
  connection: Connection,
  payer: Keypair,
  mintAuthority: Keypair,
  usdcMint: PublicKey,
  destinationWallet: PublicKey,
  amount: number
) {
    try {
        await mintTo(
        connection,
        payer,
        usdcMint,
        destinationWallet,
        mintAuthority,
        amount,
        [],
        confirmOptions
        )
    } catch (error) {
        console.error("Error minting token:", error)
        throw error
    }
}


describe('Test OAPP messaging', function() {
    console.log("Get test environment and pdas")
    const provider = anchor.AnchorProvider.env()
    const wallet = provider.wallet as anchor.Wallet
    anchor.setProvider(provider)
    const program = anchor.workspace.SolanaVault as Program<SolanaVault>
    const endpointProgram = new Program(endpointIdl as Idl, LAYERZERO_ENDPOINT_PROGRAM_ID, provider) as Program<Endpoint>
    const ulnProgram = anchor.workspace.Uln as Program<Uln>
    const usdcMintAuthority = Keypair.generate()
    const userWallet = Keypair.generate()
    const attackerWallet = Keypair.generate();
    const endpointAdmin = wallet.payer
    let USDC_MINT: PublicKey
    const DST_EID = MainnetV2EndpointId.ETHEREUM_V2_MAINNET
    const DEPOSIT_AMOUNT = 1e9;    // 1000 USDC
    const WITHDRAW_AMOUNT = 1e9;   // 1000 USDC
    const WITHDRAW_FEE = 1e6;      // 1 USDC
    const LZ_FEE = 1000;
    let oappConfigPda: PublicKey
    let userUSDCAccount: Account
    let vaultUSDCAccount: Account
    let attackerUSDCAccount: Account
    const vaultAuthorityPda = getVaultAuthorityPda(program.programId)
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
    const tokenSymbol = "USDC"
    const brokerId = "woofi_pro"
    const tokenHash = Array.from(Buffer.from(utils.getTokenHash(tokenSymbol).slice(2), 'hex'))
    const brokerHash = Array.from(Buffer.from(utils.getBrokerHash(brokerId).slice(2), 'hex'))
 
    before("Preparing for tests", async () => {

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

        oappConfigPda = (await initOapp(wallet, program, endpointProgram, USDC_MINT)).oappConfigPda
        console.log("✅ Init Oapp")

    
        await setVault(wallet, program, DST_EID)
        console.log("✅ Set Vault")

        const peerPda = getPeerPda(program.programId, oappConfigPda, DST_EID)
        const PEER_ADDRESS = Array.from(wallet.publicKey.toBytes())  // placeholder for peer address
        
        await program.methods
        .setPeer({
            dstEid: ETHEREUM_EID,
            peer: PEER_ADDRESS
        })
        .accounts({
            admin: wallet.publicKey,
            peer: peerPda,
            oappConfig: oappConfigPda,
            systemProgram: SystemProgram.programId
        })
        .rpc(confirmOptions)
        console.log("✅ Set Peer")
            
        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappConfigPda, DST_EID)
        
        await program.methods
        .setEnforcedOptions({
            dstEid: DST_EID,
            send: Buffer.from([0, 3, 3]),
            sendAndCall: Buffer.from([0, 3, 3])
        })
        .accounts({
            admin: wallet.publicKey,
            oappConfig: oappConfigPda,
            enforcedOptions: efOptionsPda,
            systemProgram: SystemProgram.programId
        })
        .rpc(confirmOptions)
        console.log("✅ Set Enforced Options")


        const endpointPda = getEndpointSettingPda(endpointProgram.programId)  
        
        await endpointProgram.methods
            .initEndpoint({
                eid: 30168,
                admin: endpointAdmin.publicKey
            })
            .accounts({
                endpoint: endpointPda,
                payer: wallet.publicKey,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)
        console.log("✅ Init Endpoint Mock")
        
        console.log('ulnProgram.programId', ulnProgram.programId)
        messageLibPda = getMessageLibPda(ulnProgram.programId)
        messageLibInfoPda = getMessageLibInfoPda(messageLibPda)

        console.log("messageLibPda", messageLibPda.toBase58())
        console.log("messageLibInfoPda", messageLibInfoPda.toBase58())

        
        await endpointProgram.methods
            .registerLibrary({
                libProgram: ulnProgram.programId,
                libType: {sendAndReceive: {}}
            })
            .accounts({
                admin: endpointAdmin.publicKey,
                endpoint: endpointPda,
                messageLibInfo: messageLibInfoPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc(confirmOptions)
        console.log("✅ Register Library")
    
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        sendLibraryConfigPda = getSendLibConfigPda(oappConfigPda, DST_EID)
        defaultSendLibraryConfigPda = getDefaultSendLibConfigPda(DST_EID)
        
        // Need to initialize the Send Library before clear() and send() can be called in the Endpoint
        // These are needed for deposit() and oapp_quote() instructions in SolanaVault
        await endpointProgram.methods
            .initSendLibrary({
                sender: oappConfigPda,
                eid: DST_EID
            })
            .accounts({
                delegate: wallet.publicKey,
                oappRegistry: oappRegistryPda,
                sendLibraryConfig: sendLibraryConfigPda,
                systemProgram: SystemProgram.programId,        
            })
            .rpc(confirmOptions)
        console.log("✅ Init Send Library")
        
        await endpointProgram.methods
            .initDefaultSendLibrary({
                eid: DST_EID,
                newLib: messageLibPda
            })
            .accounts({
                admin: endpointAdmin.publicKey,
                endpoint: endpointPda,
                defaultSendLibraryConfig: defaultSendLibraryConfigPda,
                messageLibInfo: messageLibInfoPda,
                systemProgram: SystemProgram.programId
            })
            .signers([endpointAdmin])
            .rpc(confirmOptions)
        console.log("✅ Init Default Send Library")

        await ulnProgram.methods
            .initUln({
                eid: SOLANA_EID,
                endpoint: LAYERZERO_ENDPOINT_PROGRAM_ID,
                endpointProgram: LAYERZERO_ENDPOINT_PROGRAM_ID,
                admin: wallet.publicKey,
            })
            .accounts({
                payer: wallet.publicKey,
                uln: messageLibPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)
        console.log("✅ Initialized ULN")

        noncePda = getNoncePda(oappConfigPda, ETHEREUM_EID, wallet.publicKey.toBuffer())
        pendingInboundNoncePda = getPendingInboundNoncePda(oappConfigPda, ETHEREUM_EID, wallet.publicKey.toBuffer())
        
        await endpointProgram.methods
            .initNonce({
                localOapp: oappConfigPda,
                remoteEid: ETHEREUM_EID,
                remoteOapp: Array.from(wallet.publicKey.toBytes())
            })
            .accounts({
                delegate: wallet.publicKey,
                oappRegistry: oappRegistryPda,
                nonce: noncePda,
                pendingInboundNonce: pendingInboundNoncePda,
                systemProgram: SystemProgram.programId
            })
            .signers([endpointAdmin])
            .rpc(confirmOptions)
        console.log("✅ Initialized Nonce")

      
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
        const allowedTokenPda = getTokenPdaWithBuf(program.programId, tokenHash)
        const peerPda = getPeerPda(program.programId, oappConfigPda, DST_EID)
        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappConfigPda, DST_EID)

        await program.methods
            .setToken({
                mintAccount: USDC_MINT,
                tokenHash: tokenHash,
                allowed: true
            })
            .accounts({
                admin: wallet.publicKey,
                allowedToken: allowedTokenPda,
                mintAccount: USDC_MINT,
                oappConfig: oappConfigPda
            })
            .rpc(confirmOptions)
        console.log("✅ Set USDC Token")

        const allowedBrokerPda = getBrokerPdaWithBuf(program.programId, brokerHash)
        
        await program.methods
            .setBroker({
                brokerHash: brokerHash,
                allowed: true
            })
            .accounts({
                admin: wallet.publicKey,
                allowedBroker: allowedBrokerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)
        console.log("✅ Set Broker")

        await mintTokenTo(
            provider.connection,
            wallet.payer,
            usdcMintAuthority,
            USDC_MINT,
            userUSDCAccount.address,
            DEPOSIT_AMOUNT // 1000 USDC
        )
        console.log(`✅ Minted ${DEPOSIT_AMOUNT} USDC to user deposit wallet`)

        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const eventAuthorityPda = getEventAuthorityPda()
        const noncePda = getNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())
        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await getTokenBalance(provider.connection, userUSDCAccount.address)

        const deposit = async (signer: Keypair, params, feeParams, accounts, remainingAccounts) => {
            await program.methods
            .deposit(params, feeParams)
            .accounts(accounts)
            .remainingAccounts(remainingAccounts)
            .signers([signer])
            .rpc(confirmOptions)
        }
        const solAccountId = Array.from(Buffer.from(utils.getSolAccountId(userWallet.publicKey, brokerId).slice(2), 'hex'));

        const params = {
            accountId: solAccountId,
            brokerHash: brokerHash,
            tokenHash: tokenHash,
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

        const depositRemainingAccounts = [
            {
                pubkey: endpointProgram.programId,
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: oappConfigPda, // signer and sender
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: ulnProgram.programId,
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: sendLibraryConfigPda,
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: defaultSendLibraryConfigPda,
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: messageLibInfoPda,
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: endpointPda,
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: noncePda, // nonce
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: eventAuthorityPda,
                isWritable: true,
                isSigner: false,
            },
            {
                pubkey: endpointProgram.programId,
                isWritable: true,
                isSigner: false,
            },
        ]


        await deposit(userWallet, params, feeParams, accounts, depositRemainingAccounts)

        const nonce = await endpointProgram.account.nonce.fetch(noncePda)
        assert.ok(nonce.outboundNonce.eq(new BN(1)))

        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.ok(vaultAuthority.depositNonce.eq(new BN(1)))

        currUserUSDCBalance = await getTokenBalance(provider.connection, userUSDCAccount.address)
        assert.equal(currUserUSDCBalance, prevUserUSDCBalance - DEPOSIT_AMOUNT)
        
        currVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(currVaultUSDCBalance, prevVaultUSDCBalance + DEPOSIT_AMOUNT)
        console.log("✅ Check account states after deposit")

        console.log("✅ Executed deposit USDC")

        const attackerAccountId = Array.from(Buffer.from(utils.getSolAccountId(attackerWallet.publicKey, brokerId).slice(2), 'hex'));
        const invalidAccountId = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        try {
            console.log("🥷 Attacker tries to deposit with invalid account id")
            const paramsWithdrawInvalidAccountId = {
                accountId: invalidAccountId,
                brokerHash: brokerHash,
                tokenHash: tokenHash,
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
            await deposit(attackerWallet, paramsWithdrawInvalidAccountId, feeParams, accountsWithInvalidAccountId, depositRemainingAccounts)

        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "InvalidAccountId")
            console.log("🥷 Attacker failed to deposit with invalid account id")
        }
        
        // try to deposit memecoin
        try {
            console.log("🥷 Attacker tries to deposit MEME coin")
    
            const depositParamsWithMemeCoin = {
                accountId: attackerAccountId,
                brokerHash: brokerHash,
                tokenHash: tokenHash,
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
            await deposit(attackerWallet, depositParamsWithMemeCoin, feeParams, accountWithMemeCoin, depositRemainingAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("🥷 Attacker failed to deposit MEME coin")
        }


        // try to deposit with invalid broker
        try {
            console.log("🥷 Attacker tries to deposit with unallowed broker")


            const invalidBrokerHash = Array.from(Buffer.from(utils.getBrokerHash("invalid_broker").slice(2), 'hex'))
            const invalidBrokerPda = getBrokerPdaWithBuf(program.programId, invalidBrokerHash)

            await program.methods
            .setBroker({
                brokerHash: invalidBrokerHash,
                allowed: false
            })
            .accounts({
                admin: wallet.publicKey,
                allowedBroker: invalidBrokerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)
            console.log("✅ Set Invalid Broker as not allowed")

            const depositParamsWithInvalidBroker = {
                accountId: attackerAccountId,
                brokerHash: invalidBrokerHash,
                tokenHash: tokenHash,
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
            await deposit(attackerWallet, depositParamsWithInvalidBroker, feeParams, accountWithInvalidBroker, depositRemainingAccounts)
    } catch(e) {
        assert.equal(e.error.errorCode.code, "BrokerNotAllowed")
        console.log("🥷 Attacker failed to deposit with unallowed broker")
    }  
    })

    it('LzReceive tests', async () => {    
        console.log("🚀 Starting lzReceive tests")
        // const noncePda = getNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())
        const guid = Array.from(Keypair.generate().publicKey.toBuffer())
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        const eventAuthorityPda = getEventAuthorityPda()
        const pendingInboundNoncePda = getPendingInboundNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())
        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const receiveLibraryConfigPda = getReceiveLibConfigPda(oappConfigPda, ETHEREUM_EID)
        const defaultReceiveLibraryConfigPda = getDefaultReceiveLibConfigPda(ETHEREUM_EID)
        const messageLibPda = getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = getMessageLibInfoPda(messageLibPda)
        const msgSender = wallet.publicKey   // placeholder as an OAPP sender

        let nonce, msg, payload, params, accounts

        // ================== Initialize Receive Library ==================
        await endpointProgram.methods.initReceiveLibrary(
            {
                receiver: oappConfigPda,
                eid: ETHEREUM_EID
            }
        ).accounts({
            delegate: wallet.publicKey,
                oappRegistry: oappRegistryPda,
                receiveLibraryConfig: receiveLibraryConfigPda,
                systemProgram: SystemProgram.programId,    
        }).signers([endpointAdmin])
        .rpc(confirmOptions)
        console.log("✅ Initialized Receive Library")

        await endpointProgram.methods
            .initDefaultReceiveLibrary({
                eid: ETHEREUM_EID,
                newLib: messageLibPda
            })
            .accounts({
                admin: endpointAdmin.publicKey,
                endpoint: endpointPda,
                defaultReceiveLibraryConfig: defaultReceiveLibraryConfigPda,
                messageLibInfo: messageLibInfoPda,
                systemProgram: SystemProgram.programId
            })
            .signers([endpointAdmin])
            .rpc(confirmOptions)
        console.log("✅ Initialized Default Receive Library")

        // ================== Init the Verify for Withdraw Msg ==================

        const initVerify = async (nonce) => {
            const payloadHashPda = getPayloadHashPda(oappConfigPda, ETHEREUM_EID, wallet.publicKey, BigInt(nonce))
            await endpointProgram.methods
            .initVerify({
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
                receiver: oappConfigPda,
                nonce: new BN(nonce)
            })
            .accounts({
                payer: wallet.publicKey,
                nonce: noncePda,
                payloadHash: payloadHashPda,
                systemProgram: SystemProgram.programId
            })
            .signers([endpointAdmin])
            .rpc(confirmOptions)
            console.log(`✅ Initialized Verify for message ${nonce}`)
        }

        nonce = 1
        
        await initVerify(nonce)
       
                
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
        const tokenPda = getTokenPdaWithBuf(program.programId, tokenHash)
        const brokerPda = getBrokerPdaWithBuf(program.programId, brokerHash)
        // const squads_account = new PublicKey("AbQgW1N8JAZxQFdh3VTx3ukGdGCN1vQYADktp3d2HDYw");

        const oappConfigPdaData = await program.account.oAppConfig.fetch(oappConfigPda);
        

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
            Buffer.from(brokerHash), 
            Buffer.from(tokenHash), 
            tokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        msg = encodeMessage(msgType, payload)
        console.log("✅ Generated a withdraw message")

        
        // ================== Commit and Verify 1st Withdraw Msg ==================
        
        const commitVerify = async (nonce, msg)  => { 
            const payloadHashPda = getPayloadHashPda(oappConfigPda, ETHEREUM_EID, wallet.publicKey, BigInt(nonce))
            await ulnProgram.methods.commitVerification({
                nonce: new BN(nonce),         // lz msg nonce from orderly chain to solana
                srcEid: ETHEREUM_EID,
                sender: msgSender,
                dstEid: SOLANA_EID,
                receiver: Array.from(oappConfigPda.toBytes()),
                guid: guid,
                message: msg
            }).accounts({
                uln: messageLibPda
            }).remainingAccounts([
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: messageLibPda, // receiver library
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: receiveLibraryConfigPda, // receive library config
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: defaultReceiveLibraryConfigPda, // default receive libary config
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: noncePda, // nonce
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: pendingInboundNoncePda, // pending inbound nonce
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: payloadHashPda, // payload hash
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: eventAuthorityPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
            ]).rpc(confirmOptions)

            console.log(`✅ Commit verification for message ${nonce} `)
        }

        
        await commitVerify(nonce, msg)
        

        const lzReceive = async (signer: Keypair, params, accounts, nonce) => {
            const payloadHashPda = getPayloadHashPda(oappConfigPda, ETHEREUM_EID, wallet.publicKey, BigInt(nonce))
            const lzReceiveRemainingAccounts= [
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: oappConfigPda, // signer and receiver
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: oappRegistryPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: noncePda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: payloadHashPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: endpointPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: eventAuthorityPda,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
            ]
            await program.methods
                .lzReceive(params)
                .accounts(accounts)
                .remainingAccounts(lzReceiveRemainingAccounts)
                .signers([signer])
                .rpc(confirmOptions)
            console.log(`✅ Executed lzReceive for message ${nonce}`)
        }

        const peerPda = getPeerPda(program.programId, oappConfigPda, DST_EID)

        // get initial balance
        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await getTokenBalance(provider.connection, userUSDCAccount.address)
        
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
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
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
                adminTokenAccount: adminUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,
            } 
            await lzReceive(attackerWallet, params, accountsWithInvalidReceiver, nonce)
        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "InvalidReceiver")
            console.log("🥷 Attacker failed to steal USDC")
        }
        
        // try to exectue the lzReceive with memecoin withdraw
        try {
            console.log("🥷 Attacker frontruns to execute withdrawal with memecoin")
           
            prevVaultMEMEBalance = await getTokenBalance(provider.connection, vaultMEMEAccount.address)

            // mint 1000 MEME coin to the vault authority
            await mintTokenTo(
                provider.connection,
                wallet.payer,
                memeMintAuthority,
                MEME_MINT,   // MEME coin
                vaultMEMEAccount.address,
                WITHDRAW_AMOUNT // 1000 MEME coin
            )

            currVaultMEMEBalance = await getTokenBalance(provider.connection, vaultMEMEAccount.address)
            assert.equal(currVaultMEMEBalance, prevVaultMEMEBalance + WITHDRAW_AMOUNT)
            console.log(`🥷 Attacker minted ${WITHDRAW_AMOUNT} MEME to vault authority`)

            const params = {
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
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
                adminTokenAccount: adminUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await lzReceive(attackerWallet, params, accountsWithMemeToken, nonce)       
        } catch(e) {
            
            // assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("🥷 Attacker failed to execute withdrawal with meme coin")
        }

        // try to execute the lzReceive USDC with not allowed broker
        try {
            await program.methods
            .setBroker({
                brokerHash: brokerHash,
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
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
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
                adminTokenAccount: adminUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await lzReceive(attackerWallet, params, accountsWithInvalidBroker, nonce)
        } catch(e)
        {   
            // console.log(e)
            // assert.equal(e.error.errorCode.code, "BrokerNotAllowed")
            console.log("🥷 Attacker failed to execute withdrawal with not allowed broker")
        }

        await program.methods
        .setBroker({
            brokerHash: brokerHash,
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
            await program.methods
            .setToken({
                mintAccount: USDC_MINT,
                tokenHash: tokenHash,
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
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
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
            await lzReceive(attackerWallet, params, accountsWithUnlistedToken, nonce)
        } catch(e)
        {   
            // console.log(e)
            // assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("🥷 Attacker failed to execute withdrawal with not allowed token")
        }

        await program.methods
            .setToken({
                mintAccount: USDC_MINT,
                tokenHash: tokenHash,
                allowed: true
            })
            .accounts({
                admin: wallet.publicKey,
                allowedToken: tokenPda,
                oappConfig: oappConfigPda,
                mintAccount: USDC_MINT
            }).signers([endpointAdmin]).rpc(confirmOptions);

        console.log("✅ Set token allowed")

       
        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await getTokenBalance(provider.connection, userUSDCAccount.address)
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
            srcEid: ETHEREUM_EID,
            sender: Array.from(wallet.publicKey.toBytes()),
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
            adminTokenAccount: adminUSDCAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        await lzReceive(wallet.payer, params, accounts, nonce)
      

        // Check balance after lzReceive
        currVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(prevVaultUSDCBalance - currVaultUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        currUserUSDCBalance = await getTokenBalance(provider.connection, userUSDCAccount.address)
        assert.equal(currUserUSDCBalance - prevUserUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)
        console.log("✅ Executed lzReceive instruction to withdraw USDC successfully")

        nonce = 2
        await initVerify(nonce)
        await commitVerify(nonce, msg)
    
        await freezeAccount(
            provider.connection,
            wallet.payer,
            userUSDCAccount.address,
            USDC_MINT,
            usdcMintAuthority,
        )
        
        console.log("✅ Frozen USDC ATA")

        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        prevUserUSDCBalance = await getTokenBalance(provider.connection, userUSDCAccount.address)

        params = {
            srcEid: ETHEREUM_EID,
            sender: Array.from(wallet.publicKey.toBytes()),
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
            adminTokenAccount: adminUSDCAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
        }
        await lzReceive(wallet.payer, params, accounts, nonce)
     
        currVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(prevVaultUSDCBalance - currVaultUSDCBalance, 0)
        assert.equal(currVaultUSDCBalance, WITHDRAW_FEE)

        currUserUSDCBalance = await getTokenBalance(provider.connection, userUSDCAccount.address)
        assert.equal(currUserUSDCBalance - prevUserUSDCBalance, 0)
        console.log(`✅ Executed lzReceive instruction to withdraw USDC successfully with frozen ATA`)

        nonce = 3
        await initVerify(nonce)
        await commitVerify(nonce, msg)
        
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

        // try to steal token from squads account
        try {
            console.log("🥷 Attacker frontruns to steal USDC from Squads for a closed ATA")
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
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
                nonce: new BN(nonce),
                guid: guid,
                message: msg,
                extraData: Buffer.from([])
            }

            await provider.connection.requestAirdrop(attackerWallet.publicKey, 10e9)
            // console.log(attackerWallet.publicKey.toBase58())
            const accountsWithInvalidSquads = {
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
                adminTokenAccount: attackerDepositWallet.address,
                tokenProgram: TOKEN_PROGRAM_ID,
            } 
            await lzReceive(attackerWallet, params, accountsWithInvalidSquads, nonce)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "InvalidAdminTokenAccount")
            console.log("🥷 Attacker failed to steal USDC")
        }

        console.log("✅ Closed USDC ATA")
        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)

        // attacker try to steal usdc when the ata is closed

        try {
            const params = {
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
                nonce: new BN(nonce),
                guid: guid,
                message: msg,
                extraData: Buffer.from([])
            }
            const accountsWithInvalidAdminTokenAccount = {

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
                adminTokenAccount: attackerUSDCAccount.address,
                tokenProgram: TOKEN_PROGRAM_ID,
            }

            await lzReceive(attackerWallet, params, accountsWithInvalidAdminTokenAccount, nonce)
        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "InvalidAdminTokenAccount")
            console.log("🥷 Attacker failed to steal USDC from closed ATA ")

        }
        
        params = {
            srcEid: ETHEREUM_EID,
            sender: Array.from(wallet.publicKey.toBytes()),
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
            adminTokenAccount: adminUSDCAccount.address,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        await mintTokenTo(provider.connection, wallet.payer, usdcMintAuthority, USDC_MINT, vaultUSDCAccount.address, WITHDRAW_AMOUNT)

        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        let prevAdminBalance = await getTokenBalance(provider.connection, adminUSDCAccount.address)
        
        await lzReceive(wallet.payer, params, accounts, nonce)
       
        currVaultUSDCBalance = await getTokenBalance(provider.connection, vaultUSDCAccount.address)
        assert.equal(prevVaultUSDCBalance - currVaultUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)
        let currSqaudsBalance = await getTokenBalance(provider.connection, adminUSDCAccount.address)
        assert.equal(currSqaudsBalance - prevAdminBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        console.log("✅ Executed lzReceive instruction to withdraw USDC to Squads with closed ATA")
    })

    



    it('Quote tests', async () => {
        console.log("🚀 Starting quote tests")
        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const oappConfigPda = getOAppConfigPda(program.programId)
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        const sendLibraryConfigPda = getSendLibConfigPda(oappConfigPda, DST_EID)
        const defaultSendLibraryConfigPda = getDefaultSendLibConfigPda(DST_EID)
        const messageLibPda = getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = getMessageLibInfoPda(messageLibPda)
        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappConfigPda, DST_EID)    
        const eventAuthorityPda = getEventAuthorityPda()
        const noncePda = getNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())
        const pendingInboundNoncePda = getPendingInboundNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())

        const peerPda = getPeerPda(program.programId, oappConfigPda, DST_EID)
        // const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        const brokerHash = tokenHash;
        const {lzTokenFee, nativeFee} = await program.methods
            .oappQuote({
                accountId: Array.from(wallet.publicKey.toBytes()),
                brokerHash: brokerHash,
                tokenHash: tokenHash,
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