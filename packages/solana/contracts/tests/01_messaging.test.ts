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
  ASSOCIATED_TOKEN_PROGRAM_ID
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
import { registerOapp, initializeVault, confirmOptions } from './setup'

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

async function mintUsdcTo(
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

    console.log(`Minted ${amount} USDC to ${destinationWallet.toBase58()}`)
  } catch (error) {
    console.error("Error minting USDC:", error)
    throw error
  }
}

async function mintMEMETo(
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
  
      console.log(`Minted ${amount} MEME to ${destinationWallet.toBase58()}`)
    } catch (error) {
      console.error("Error minting MEME:", error)
      throw error
    }
  }

describe('messaging', function() {
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
    let oappPda: PublicKey
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
    const memeMintAuthority = Keypair.generate()

    before(async () => {
        USDC_MINT = await createMint(
            provider.connection,
            wallet.payer,
            usdcMintAuthority.publicKey,
            null,
            6, // USDC has 6 decimals
            Keypair.generate(),
            confirmOptions
        )

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
            true
        )

        await initializeVault(wallet, program, DST_EID)
        oappPda = (await registerOapp(wallet, program, endpointProgram, USDC_MINT)).oappPda

        const peerPda = getPeerPda(program.programId, oappPda, DST_EID)
        const PEER_HASH = Array.from(wallet.publicKey.toBytes())

        await program.methods
            .setPeer({
                dstEid: ETHEREUM_EID,
                peer: PEER_HASH
            })
            .accounts({
                admin: wallet.publicKey,
                peer: peerPda,
                oappConfig: oappPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)

        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappPda, DST_EID)

        await program.methods
            .setEnforcedOptions({
                dstEid: DST_EID,
                send: Buffer.from([0, 3, 3]),
                sendAndCall: Buffer.from([0, 3, 3])
            })
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda,
                enforcedOptions: efOptionsPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)


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
        
        const oappRegistryPda = getOAppRegistryPda(oappPda)
        sendLibraryConfigPda = getSendLibConfigPda(oappPda, DST_EID)
        defaultSendLibraryConfigPda = getDefaultSendLibConfigPda(DST_EID)
        
        // Need to initialize the Send Library before clear() and send() can be called in the Endpoint
        // These are needed for deposit() and oapp_quote() instructions in SolanaVault
        await endpointProgram.methods
            .initSendLibrary({
                sender: oappPda,
                eid: DST_EID
            })
            .accounts({
                delegate: wallet.publicKey,
                oappRegistry: oappRegistryPda,
                sendLibraryConfig: sendLibraryConfigPda,
                systemProgram: SystemProgram.programId,        
            })
            .rpc(confirmOptions)

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



        // deploy a memecoin
        MEME_MINT = await createMint(
            provider.connection,
            wallet.payer,
            memeMintAuthority.publicKey,
            null,
            6, // USDC has 6 decimals
            Keypair.generate(),
            confirmOptions
        );

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
        
        // mint 1000 MEME coin to the user
        await mintMEMETo(
            provider.connection,
            wallet.payer,
            memeMintAuthority,
            MEME_MINT,   // MEME coin
            userMemeDepositWallet.address,
            1e9 // 1000 USDC
        )


         
    })
    
    it('lzReceive', async () => {        
        const guid = Array.from(Keypair.generate().publicKey.toBuffer())
        const oappRegistryPda = getOAppRegistryPda(oappPda)
        const eventAuthorityPda = getEventAuthorityPda()
        const payloadHashPda = getPayloadHashPda(oappPda, ETHEREUM_EID, wallet.publicKey, BigInt('1'))
        const noncePda = getNoncePda(oappPda, ETHEREUM_EID, wallet.publicKey.toBuffer())
        const pendingInboundNoncePda = getPendingInboundNoncePda(oappPda, ETHEREUM_EID, wallet.publicKey.toBuffer())
        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const receiveLibraryConfigPda = getReceiveLibConfigPda(oappPda, ETHEREUM_EID)
        const defaultReceiveLibraryConfigPda = getDefaultReceiveLibConfigPda(ETHEREUM_EID)
        const messageLibPda = getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = getMessageLibInfoPda(messageLibPda)

        const transaction = new Transaction()
        
        transaction.add(
            await endpointProgram.methods
                .initReceiveLibrary({
                    receiver: oappPda,
                    eid: ETHEREUM_EID
                })
                .accounts({
                    delegate: wallet.publicKey,
                    oappRegistry: oappRegistryPda,
                    receiveLibraryConfig: receiveLibraryConfigPda,
                    systemProgram: SystemProgram.programId,        
                })
                .instruction()
        )

        transaction.add(
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
                .instruction()
        )

        // Initialize the nonce before we can initialize verify
        transaction.add(
            await endpointProgram.methods
                .initNonce({
                    localOapp: oappPda,
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
                .instruction()
        )

        await provider.sendAndConfirm(transaction, [endpointAdmin, wallet.payer], confirmOptions)

        // This initializes the payload_hash account
        await endpointProgram.methods
            .initVerify({
                srcEid: ETHEREUM_EID,
                sender: Array.from(wallet.publicKey.toBytes()),
                receiver: oappPda,
                nonce: new BN('1')
            })
            .accounts({
                payer: wallet.publicKey,
                nonce: noncePda,
                payloadHash: payloadHashPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)
        // console.log("PROGRAM ID: ", ulnProgram.programId)
        
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
        
        const msgType = 1 // Withdraw message type
        const tokenAmountBuffer = Buffer.alloc(8)
        tokenAmountBuffer.writeBigUInt64BE(BigInt(1e9))

        const feeBuffer = Buffer.alloc(8)
        feeBuffer.writeBigUInt64BE(BigInt('100'))

        const chainIdBuffer = Buffer.alloc(8)
        chainIdBuffer.writeBigUInt64BE(BigInt('1'))

        const withdrawNonceBuffer = Buffer.alloc(8)
        withdrawNonceBuffer.writeBigUInt64BE(BigInt('2'))
        const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        const payload = Buffer.concat([
            wallet.publicKey.toBuffer(),  // placeholder for account_id
            wallet.publicKey.toBuffer(),  // sender
            wallet.publicKey.toBuffer(),  // receiver
            Buffer.from(tokenHash), // placeholder for broker hash
            Buffer.from(tokenHash), // placeholder
            tokenAmountBuffer,
            feeBuffer,
            chainIdBuffer,
            withdrawNonceBuffer
        ]) // Example payload
        const message = encodeMessage(msgType, payload)

        // Verifies the payload and updates the nonce
        await ulnProgram.methods
            .commitVerification({
                nonce: new BN('1'),
                srcEid: ETHEREUM_EID,
                sender: wallet.publicKey,
                dstEid: SOLANA_EID,
                receiver: Array.from(oappPda.toBytes()),
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
        
        const peerPda = getPeerPda(program.programId, oappPda, DST_EID)

        // Check initial balance
        let vaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)

        // Mint 1000 USDC to the vault deposit wallet
        await mintUsdcTo(
            provider.connection,
            wallet.payer,
            usdcMintAuthority,
            USDC_MINT,
            vaultDepositWallet.address,
            1e9 // 1000 USDC
        )

        // Check balance after minting
        vaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        assert.equal(vaultBalance, 1e9, "Vault should have 1000 USDC after minting")

        // try to frontrun to steal USDC
        try {
            
            const attackerWallet = Keypair.generate();
            // transfer sol to attacker wallet
            await provider.connection.requestAirdrop(attackerWallet.publicKey, 1e9)

            // create usdc account for attacker
            const attackerDepositWallet = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                wallet.payer,
                USDC_MINT,
                attackerWallet.publicKey,
                true
            )
            await program.methods
                .lzReceive({
                    srcEid: ETHEREUM_EID,
                    sender: Array.from(wallet.publicKey.toBytes()),
                    nonce: new BN('1'),
                    guid: guid,
                    message: message,
                    extraData: Buffer.from([])
                })
                .accounts({
                    payer: wallet.publicKey,
                    oappConfig: oappPda,
                    peer: peerPda,
                    user: attackerWallet.publicKey,
                    userDepositWallet: attackerDepositWallet.address,
                    vaultDepositWallet: vaultDepositWallet.address,
                    depositToken: USDC_MINT,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    vaultAuthority: vaultAuthorityPda
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappPda, // signer and receiver
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
                ])
                .rpc(confirmOptions)

            
        } catch(e) {
            assert.equal(e.error.errorCode.code, "InvalidReceiver")
        }
        
        // try to frontrun to withdraw memecoin
        try {

            // mint 1000 MEME coin to the vault
            await mintMEMETo(
                provider.connection,
                wallet.payer,
                memeMintAuthority,
                MEME_MINT,   // MEME coin
                vaultMemeDepositWallet.address,
                1e9 // 1000 MEME coin
            )

            const attackerWallet = Keypair.generate();
            // transfer sol to attacker wallet
            await provider.connection.requestAirdrop(attackerWallet.publicKey, 1e9)

            await program.methods
                .lzReceive({
                    srcEid: ETHEREUM_EID,
                    sender: Array.from(wallet.publicKey.toBytes()),
                    nonce: new BN('1'),
                    guid: guid,
                    message: message,
                    extraData: Buffer.from([])
                })
                .accounts({
                    payer: wallet.publicKey,
                    oappConfig: oappPda,
                    peer: peerPda,
                    user: wallet.publicKey,
                    userDepositWallet: userMemeDepositWallet.address,
                    vaultDepositWallet: vaultMemeDepositWallet.address,
                    depositToken: MEME_MINT,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    vaultAuthority: vaultAuthorityPda
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappPda, // signer and receiver
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
                ])
                .rpc(confirmOptions)

            
        } catch(e) {
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
        }

        
        // execute the lzReceive instruction successfully
        try {
            await program.methods
                .lzReceive({
                    srcEid: ETHEREUM_EID,
                    sender: Array.from(wallet.publicKey.toBytes()),
                    nonce: new BN('1'),
                    guid: guid,
                    message: message,
                    extraData: Buffer.from([])
                })
                .accounts({
                    payer: wallet.publicKey,
                    oappConfig: oappPda,
                    peer: peerPda,
                    user: wallet.publicKey,
                    userDepositWallet: userDepositWallet.address,
                    vaultDepositWallet: vaultDepositWallet.address,
                    depositToken: USDC_MINT,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    vaultAuthority: vaultAuthorityPda
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappPda, // signer and receiver
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
                ])
                .rpc(confirmOptions)

            // Check balance after lzReceive
            vaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
            assert.equal(vaultBalance, 100, "Vault should have 100 USDC left from fees after transfer")

            const userBalance = await getTokenBalance(provider.connection, userDepositWallet.address)
            assert.equal(userBalance, 1e9 - 100, "User should have 1e9 - 100 transferred from the vault")
        } catch(e) {
            console.log(e)
        }

       

    })

    it('deposits', async() => {
        const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const allowedTokenPda = getTokenPdaWithBuf(program.programId, tokenHash)
        const peerPda = getPeerPda(program.programId, oappPda, DST_EID)
        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappPda, DST_EID)

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
                oappConfig: oappPda
            })
            .rpc(confirmOptions)
        
        const brokerHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const allowedBrokerPda = getBrokerPdaWithBuf(program.programId, brokerHash)

        await program.methods
            .setBroker({
                brokerHash: brokerHash,
                allowed: true
            })
            .accounts({
                admin: wallet.publicKey,
                allowedBroker: allowedBrokerPda,
                oappConfig: oappPda,
                systemProgram: SystemProgram.programId
            })
            .rpc(confirmOptions)

        await mintUsdcTo(
            provider.connection,
            wallet.payer,
            usdcMintAuthority,
            USDC_MINT,
            userDepositWallet.address,
            1e9 // 1000 USDC
        )
        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const eventAuthorityPda = getEventAuthorityPda()
        const noncePda = getNoncePda(oappPda, DST_EID, wallet.publicKey.toBuffer())
        const previousVaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        const previousUserBalance = await getTokenBalance(provider.connection, userDepositWallet.address)

        await program.methods
            .deposit({
                accountId: Array.from(wallet.publicKey.toBytes()),
                brokerHash: brokerHash,
                tokenHash: tokenHash,
                userAddress: Array.from(wallet.publicKey.toBytes()),
                tokenAmount: new BN(1e9),
            },{
                nativeFee: new BN(1000),
                lzTokenFee: new BN(0)
            })
            .accounts({
                user: wallet.publicKey,
                userTokenAccount: userDepositWallet.address,
                vaultAuthority: vaultAuthorityPda,
                vaultTokenAccount: vaultDepositWallet.address,
                depositToken: USDC_MINT,
                peer: peerPda,
                enforcedOptions: efOptionsPda,
                oappConfig: oappPda,
                allowedBroker: allowedBrokerPda,
                allowedToken: allowedTokenPda,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId
            })
            .remainingAccounts([
                {
                    pubkey: endpointProgram.programId,
                    isWritable: true,
                    isSigner: false,
                },
                {
                    pubkey: oappPda, // signer and sender
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
            ])
            .rpc(confirmOptions)

        const nonce = await endpointProgram.account.nonce.fetch(noncePda)
        assert.ok(nonce.outboundNonce.eq(new BN(1)))

        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.ok(vaultAuthority.depositNonce.eq(new BN(1)))

        const newUserBalance = await getTokenBalance(provider.connection, userDepositWallet.address)
        assert.equal(newUserBalance, previousUserBalance - 1e9)

        const newVaultBalance = await getTokenBalance(provider.connection, vaultDepositWallet.address)
        assert.equal(newVaultBalance, previousVaultBalance + 1e9)
        
        // try to deposit memecoin
        try {

                const previousUserMemeBalance = await getTokenBalance(provider.connection, userMemeDepositWallet.address)
                const previousVaultMemeBalance = await getTokenBalance(provider.connection, vaultMemeDepositWallet.address)
                
                await program.methods
                    .deposit({
                        accountId: Array.from(wallet.publicKey.toBytes()),
                        brokerHash: brokerHash,
                        tokenHash: tokenHash,
                        userAddress: Array.from(wallet.publicKey.toBytes()),
                        tokenAmount: new BN(1e9),
                    },{
                        nativeFee: new BN(1000),
                        lzTokenFee: new BN(0)
                    })
                    .accounts({
                        user: wallet.publicKey,
                        userTokenAccount: userMemeDepositWallet.address,
                        vaultAuthority: vaultAuthorityPda,
                        vaultTokenAccount: vaultMemeDepositWallet.address,
                        depositToken: MEME_MINT,
                        peer: peerPda,
                        enforcedOptions: efOptionsPda,
                        oappConfig: oappPda,
                        allowedBroker: allowedBrokerPda,
                        allowedToken: allowedTokenPda,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId
                    })
                    .remainingAccounts([
                        {
                            pubkey: endpointProgram.programId,
                            isWritable: true,
                            isSigner: false,
                        },
                        {
                            pubkey: oappPda, // signer and sender
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
                    ])
                    .rpc(confirmOptions)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "TokenNotAllowed")
        }
        
        
    })

    it('gets oapp quote', async () => {
        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        const oappPda = getOAppConfigPda(program.programId)
        const oappRegistryPda = getOAppRegistryPda(oappPda)
        const sendLibraryConfigPda = getSendLibConfigPda(oappPda, DST_EID)
        const defaultSendLibraryConfigPda = getDefaultSendLibConfigPda(DST_EID)
        const messageLibPda = getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = getMessageLibInfoPda(messageLibPda)
        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappPda, DST_EID)    
        const eventAuthorityPda = getEventAuthorityPda()
        const noncePda = getNoncePda(oappPda, DST_EID, wallet.publicKey.toBuffer())
        const pendingInboundNoncePda = getPendingInboundNoncePda(oappPda, DST_EID, wallet.publicKey.toBuffer())

        try {
            await endpointProgram.methods
                .initNonce({
                    localOapp: oappPda,
                    remoteEid: DST_EID,
                    remoteOapp: Array.from(wallet.publicKey.toBytes())
                })
                .accounts({
                    delegate: wallet.publicKey,
                    oappRegistry: oappRegistryPda,
                    nonce: noncePda,
                    pendingInboundNonce: pendingInboundNoncePda,
                    systemProgram: SystemProgram.programId
                })
                .rpc(confirmOptions)
        } catch(e) {
            console.log("Already initialized in 'lzReceive' test")
        }

        const peerPda = getPeerPda(program.programId, oappPda, DST_EID)
        const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
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
                oappConfig: oappPda,
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
    })
})