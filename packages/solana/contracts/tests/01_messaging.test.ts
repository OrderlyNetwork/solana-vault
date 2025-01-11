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
    const endpointAdmin = wallet.payer
    let USDC_MINT: PublicKey
    const DST_EID = MainnetV2EndpointId.ETHEREUM_V2_MAINNET
    const DEPOSIT_AMOUNT = 1e9;    // 1000 USDC
    const WITHDRAW_AMOUNT = 1e9;   // 1000 USDC
    const WITHDRAW_FEE = 1e6;      // 1 USDC
    const LZ_FEE = 1000;
    let oappConfigPda: PublicKey
    let userDepositWallet: Account
    let vaultDepositWallet: Account
    const vaultAuthorityPda = getVaultAuthorityPda(program.programId)
    let sendLibraryConfigPda: PublicKey
    let defaultSendLibraryConfigPda: PublicKey
    let messageLibInfoPda: PublicKey
    let messageLibPda: PublicKey
    let MEME_MINT: PublicKey
    let userMemeDepositWallet: Account
    let vaultMemeDepositWallet: Account
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

        // Setup Wallets
        userDepositWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            wallet.publicKey
        )
        vaultDepositWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            USDC_MINT,
            vaultAuthorityPda,
            true                // prevent TokenOwnerOffCurveError,
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
    
        messageLibPda = getMessageLibPda(ulnProgram.programId)
        messageLibInfoPda = getMessageLibInfoPda(messageLibPda)
        
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
        userMemeDepositWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            MEME_MINT,
            wallet.publicKey
        )
        vaultMemeDepositWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            MEME_MINT,
            vaultAuthorityPda,
            true
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
            userDepositWallet.address,
            DEPOSIT_AMOUNT // 1000 USDC
        )
        console.log(`✅ Minted ${DEPOSIT_AMOUNT} USDC to user deposit wallet`)

        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const eventAuthorityPda = getEventAuthorityPda()
        const noncePda = getNoncePda(oappConfigPda, DST_EID, wallet.publicKey.toBuffer())
        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        prevUserUSDCBalance = await getTokenBalance(provider.connection, userDepositWallet.address)

        const deposit = async (signer: Keypair, params, feeParams, accounts, remainingAccounts) => {
            await program.methods
            .deposit(params, feeParams)
            .accounts(accounts)
            .remainingAccounts(remainingAccounts)
            .signers([signer])
            .rpc(confirmOptions)
        }
        const solAccountId = Array.from(Buffer.from(utils.getSolAccountId(wallet.publicKey, brokerId).slice(2), 'hex'));

        const params = {
            accountId: solAccountId,
            brokerHash: brokerHash,
            tokenHash: tokenHash,
            userAddress: Array.from(wallet.publicKey.toBytes()),
            tokenAmount: new BN(DEPOSIT_AMOUNT),
        }

        const feeParams = {
            nativeFee: new BN(LZ_FEE),
            lzTokenFee: new BN(0)
        }

        const accounts = {
            user: wallet.publicKey,
            userTokenAccount: userDepositWallet.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultDepositWallet.address,
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


        await deposit(wallet.payer, params, feeParams, accounts, depositRemainingAccounts)
        console.log("✅ Executed deposit USDC")

        try {
            console.log("🥷 Attacker tries to deposit with wrong broker")
            const params2 = {
                accountId: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                brokerHash: brokerHash,
                tokenHash: tokenHash,
                userAddress: Array.from(wallet.publicKey.toBytes()),
                tokenAmount: new BN(DEPOSIT_AMOUNT),
            }
            await deposit(wallet.payer, params2, feeParams, accounts, depositRemainingAccounts)

        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "InvalidAccountId")
            console.log("🥷 Attacker failed to deposit with wrong broker")
        }

        const nonce = await endpointProgram.account.nonce.fetch(noncePda)
        assert.ok(nonce.outboundNonce.eq(new BN(1)))

        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.ok(vaultAuthority.depositNonce.eq(new BN(1)))

        currUserUSDCBalance = await getTokenBalance(provider.connection, userDepositWallet.address)
        assert.equal(currUserUSDCBalance, prevUserUSDCBalance - DEPOSIT_AMOUNT)
        
        currVaultUSDCBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        assert.equal(currVaultUSDCBalance, prevVaultUSDCBalance + DEPOSIT_AMOUNT)
        console.log("✅ Check account states after deposit")
        
        // try to deposit memecoin
        try {
                console.log("🥷 Attacker tries to deposit MEME coin")
                const previousUserMemeBalance = await getTokenBalance(provider.connection, userMemeDepositWallet.address)
                const previousVaultMemeBalance = await getTokenBalance(provider.connection, vaultMemeDepositWallet.address)
                
                const depositParams = {
                    accountId: Array.from(wallet.publicKey.toBytes()),
                    brokerHash: brokerHash,
                    tokenHash: tokenHash,
                    userAddress: Array.from(wallet.publicKey.toBytes()),
                    tokenAmount: new BN(DEPOSIT_AMOUNT),
                }
                const feeParams = {
                    nativeFee: new BN(LZ_FEE),
                    lzTokenFee: new BN(0)
                }
                const account ={
                    user: wallet.publicKey,
                    userTokenAccount: userMemeDepositWallet.address,
                    vaultAuthority: vaultAuthorityPda,
                    vaultTokenAccount: vaultMemeDepositWallet.address,
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
                await deposit(wallet.payer, depositParams, feeParams, account, depositRemainingAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
            console.log("🥷 Attacker failed to deposit MEME coin")
        }
        
        
    })
    


    it('LzReceive tests', async () => {    
        console.log("🚀 Starting lzReceive tests")
        const guid = Array.from(Keypair.generate().publicKey.toBuffer())
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        const eventAuthorityPda = getEventAuthorityPda()
        const payloadHashPda = getPayloadHashPda(oappConfigPda, ETHEREUM_EID, wallet.publicKey, BigInt('1'))
        const payloadHashPdaSecond = getPayloadHashPda(oappConfigPda, ETHEREUM_EID, wallet.publicKey, BigInt('2'))
        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const receiveLibraryConfigPda = getReceiveLibConfigPda(oappConfigPda, ETHEREUM_EID)
        const defaultReceiveLibraryConfigPda = getDefaultReceiveLibConfigPda(ETHEREUM_EID)
        const messageLibPda = getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = getMessageLibInfoPda(messageLibPda)

       
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
        
        await endpointProgram.methods
            .initVerify({
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
                receiver: oappConfigPda,
                nonce: new BN('1')
            })
            .accounts({
                payer: wallet.publicKey,
                nonce: noncePda,
                payloadHash: payloadHashPda,
                systemProgram: SystemProgram.programId
            })
            .signers([endpointAdmin])
            .rpc(confirmOptions)
        console.log("✅ Initialized Verify")
        
        
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
        const payload = Buffer.concat([
            wallet.publicKey.toBuffer(),  // placeholder for account_id
            wallet.publicKey.toBuffer(),  // sender     
            wallet.publicKey.toBuffer(),  // receiver
            Buffer.from(brokerHash), // placeholder for broker hash
            Buffer.from(tokenHash), // placeholder for token hash
            tokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        const message = encodeMessage(msgType, payload)
        console.log("✅ Generated a withdraw message")

        // Verifies the payload and updates the nonce
        await ulnProgram.methods
            .commitVerification({
                nonce: new BN('1'),         // lz msg nonce from orderly chain to solana
                srcEid: ETHEREUM_EID,
                sender: wallet.publicKey,
                dstEid: SOLANA_EID,
                receiver: Array.from(oappConfigPda.toBytes()),
                guid: guid,
                message: message,
            })
            .accounts({
                uln: messageLibPda
            })
            .remainingAccounts([
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
            ])
            .rpc(confirmOptions)
        console.log("✅ Commit verification for a withdraw message")

        const lzReceive = async (signer: Keypair, params, accounts, remainingAccounts) => {
            await program.methods
                .lzReceive(params)
                .accounts(accounts)
                .remainingAccounts(remainingAccounts)
                .signers([signer])
                .rpc(confirmOptions)
        }

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

        const peerPda = getPeerPda(program.programId, oappConfigPda, DST_EID)

        // get initial balance
        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        prevUserUSDCBalance = await getTokenBalance(provider.connection, userDepositWallet.address)
        const attackerWallet = Keypair.generate();
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
                nonce: new BN('1'),
                guid: guid,
                message: message,
                extraData: Buffer.from([])
            }

            const accounts = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: USDC_MINT,
                receiver: attackerWallet.publicKey,
                receiverTokenAccount: attackerDepositWallet.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultDepositWallet.address,
                tokenProgram: TOKEN_PROGRAM_ID,
            } 

            await lzReceive(attackerWallet, params, accounts, lzReceiveRemainingAccounts)
 
        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "InvalidReceiver")
            console.log("🥷 Attacker failed to steal USDC")
        }
        
        // try to exectue the lzReceive with memecoin withdraw
        try {
            console.log("🥷 Attacker frontruns to execute withdrawal with memecoin")
           
            prevVaultMEMEBalance = await getTokenBalance(provider.connection, vaultMemeDepositWallet.address)

            // mint 1000 MEME coin to the vault authority
            await mintTokenTo(
                provider.connection,
                wallet.payer,
                memeMintAuthority,
                MEME_MINT,   // MEME coin
                vaultMemeDepositWallet.address,
                WITHDRAW_AMOUNT // 1000 MEME coin
            )

            currVaultMEMEBalance = await getTokenBalance(provider.connection, vaultMemeDepositWallet.address)
            assert.equal(currVaultMEMEBalance, prevVaultMEMEBalance + WITHDRAW_AMOUNT)
            console.log(`🥷 Attacker minted ${WITHDRAW_AMOUNT} MEME to vault authority`)

            const params = {
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
                nonce: new BN('1'),
                guid: guid,
                message: message,
                extraData: Buffer.from([])
            }
            const accounts = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: MEME_MINT,
                receiver: wallet.publicKey,
                receiverTokenAccount: userMemeDepositWallet.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultMemeDepositWallet.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await lzReceive(attackerWallet, params, accounts, lzReceiveRemainingAccounts)       
        } catch(e) {
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
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
                nonce: new BN('1'),
                guid: guid,
                message: message,
                extraData: Buffer.from([])
            }
            const accounts = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: USDC_MINT,
                receiver: wallet.publicKey,
                receiverTokenAccount: userDepositWallet.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultDepositWallet.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await lzReceive(attackerWallet, params, accounts, lzReceiveRemainingAccounts)
        } catch(e)
        {   
            // console.log(e)
            assert.equal(e.error.errorCode.code, "BrokerNotAllowed")
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
                nonce: new BN('1'),
                guid: guid,
                message: message,
                extraData: Buffer.from([])
            }
            const accounts = {
                payer: attackerWallet.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
                brokerPda: brokerPda,
                tokenPda: tokenPda,
                tokenMint: USDC_MINT,
                receiver: wallet.publicKey,
                receiverTokenAccount: userDepositWallet.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultDepositWallet.address,
                tokenProgram: TOKEN_PROGRAM_ID,  
            }
            await lzReceive(attackerWallet, params, accounts, lzReceiveRemainingAccounts)
        } catch(e)
        {   
            // console.log(e)
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
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

       
        prevVaultUSDCBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        prevUserUSDCBalance = await getTokenBalance(provider.connection, userDepositWallet.address)
        // execute the lzReceive instruction successfully
        const params = {
            srcEid: ETHEREUM_EID,
            sender: Array.from(wallet.publicKey.toBytes()),
            nonce: new BN('1'),
            guid: guid,
            message: message,
            extraData: Buffer.from([])
        }
        const accounts = {
            payer: wallet.publicKey,
            oappConfig: oappConfigPda,
            peer: peerPda,
            brokerPda: brokerPda,
            tokenPda: tokenPda,
            tokenMint: USDC_MINT,
            receiver: wallet.publicKey,
            receiverTokenAccount: userDepositWallet.address,
            vaultAuthority: vaultAuthorityPda,
            vaultTokenAccount: vaultDepositWallet.address,
            tokenProgram: TOKEN_PROGRAM_ID,
        }

        userDepositWallet = await getAccount(
            provider.connection,
            userDepositWallet.address
        )
        console.log(userDepositWallet)
        const newOnwer = Keypair.generate()

        // Transfer ownership of the user ata to the another account
        const sig = await setAuthority(
            provider.connection,
            wallet.payer,
            userDepositWallet.address,
            wallet.payer,
            2,
            newOnwer.publicKey,  
        )

        console.log("transfer owner: ", sig)

        userDepositWallet = await getAccount(
            provider.connection,
            userDepositWallet.address
        )
        console.log("after owner transfer")
        console.log(userDepositWallet)

        await lzReceive(wallet.payer, params, accounts, lzReceiveRemainingAccounts)

        userDepositWallet = await getAccount(
            provider.connection,
            userDepositWallet.address
        )
        console.log("after token transfer")
        console.log(userDepositWallet)

        // Check balance after lzReceive
        currVaultUSDCBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        assert.equal(prevVaultUSDCBalance - currVaultUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)

        currUserUSDCBalance = await getTokenBalance(provider.connection, userDepositWallet.address)
        assert.equal(currUserUSDCBalance - prevUserUSDCBalance, WITHDRAW_AMOUNT - WITHDRAW_FEE)
        console.log("✅ Executed lzReceive instruction to withdraw USDC successfully")

        await endpointProgram.methods
        .initVerify({
            srcEid: ETHEREUM_EID,
            sender: Array.from(wallet.publicKey.toBytes()),
            receiver: oappConfigPda,
            nonce: new BN('2')
        })
        .accounts({
            payer: wallet.publicKey,
            nonce: noncePda,
            payloadHash: payloadHashPdaSecond,
            systemProgram: SystemProgram.programId
        })
        .signers([endpointAdmin])
        .rpc(confirmOptions)
    console.log("✅ Initialized Verify for second payload")

    await ulnProgram.methods
        .commitVerification({
            nonce: new BN('2'),         // lz msg nonce from orderly chain to solana
            srcEid: ETHEREUM_EID,
            sender: wallet.publicKey,
            dstEid: SOLANA_EID,
            receiver: Array.from(oappConfigPda.toBytes()),
            guid: guid,
            message: message,
        })
        .accounts({
            uln: messageLibPda
        })
        .remainingAccounts([
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
                pubkey: payloadHashPdaSecond, // payload hash
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
        ])
        .rpc(confirmOptions)
    console.log("✅ Commit verification for second withdraw message")

    await freezeAccount(
        provider.connection,
        wallet.payer,
        userDepositWallet.address,
        USDC_MINT,
        usdcMintAuthority,
    )
    
    console.log("✅ Froze user account")

    const paramsSecond = {
        srcEid: ETHEREUM_EID,
        sender: Array.from(wallet.publicKey.toBytes()),
        nonce: new BN('2'),
        guid: guid,
        message: message,
        extraData: Buffer.from([])
    }
    const accountsSecond = {
        payer: wallet.publicKey,
        oappConfig: oappConfigPda,
        peer: peerPda,
        brokerPda: brokerPda,
        tokenPda: tokenPda,
        tokenMint: USDC_MINT,
        receiver: wallet.publicKey,
        receiverTokenAccount: userDepositWallet.address,
        vaultAuthority: vaultAuthorityPda,
        vaultTokenAccount: vaultDepositWallet.address,
        tokenProgram: TOKEN_PROGRAM_ID,
    }

    const lzReceiveRemainingAccountsSecond= [
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
            pubkey: payloadHashPdaSecond,
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
    await lzReceive(wallet.payer, paramsSecond, accountsSecond, lzReceiveRemainingAccountsSecond)
    console.log("✅ Executed lzReceive instruction to withdraw USDC successfully with frozen ATA")
    // try to execute the lzReceive instruction with frozen account



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
        assert.isTrue(lzTokenFee.eq(new BN(900)))
        console.log("✅ Executed oapp quote")
    })
})