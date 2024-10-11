import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from './types/endpoint'
import { createMint } from '@solana/spl-token'
import { EVENT_SEED, MESSAGE_LIB_SEED } from "@layerzerolabs/lz-solana-sdk-v2"
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { assert } from 'chai'
import endpointIdl from './idl/endpoint.json'
import { getEndpointSettingPda } from '../scripts/utils'
import { MainnetV2EndpointId } from '@layerzerolabs/lz-definitions'
import { registerOapp, initializeVault, confirmOptions } from './setup'

let USDC_MINT: PublicKey
const LAYERZERO_ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
const ETHEREUM_EID = MainnetV2EndpointId.ETHEREUM_V2_MAINNET

describe('solana-vault', function() {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env()
    const wallet = provider.wallet as anchor.Wallet
    anchor.setProvider(provider)
    const program = anchor.workspace.SolanaVault as Program<SolanaVault>
    const endpointProgram = new Program(endpointIdl as Idl, LAYERZERO_ENDPOINT_PROGRAM_ID, provider) as Program<Endpoint>
    const ulnProgram = anchor.workspace.Uln as Program<Uln>
    // Create a mint authority for USDC
    const usdcMintAuthority = Keypair.generate()
    const endpointAdmin = wallet.payer
    const DST_EID = ETHEREUM_EID
    const PEER_HASH = Array.from(wallet.publicKey.toBytes())
    let vaultAuthority
    let oappPda: PublicKey
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("VaultAuthority")],
        program.programId
    )

    before(async () => {
        USDC_MINT = await createMint(
            provider.connection,
            wallet.payer,
            usdcMintAuthority.publicKey,
            null,
            6,
            Keypair.generate(),
            confirmOptions
        )
        // 1. Setup Solana Vault
        try {
            oappPda = (await registerOapp(wallet, program, endpointProgram, USDC_MINT)).oappPda
            vaultAuthority = (await initializeVault(wallet, program, DST_EID)).vaultAuthority

            const bufferDstEid = Buffer.alloc(4)
            bufferDstEid.writeUInt32BE(DST_EID)
            const [efOptionsPda, efOptionsBump] = PublicKey.findProgramAddressSync(
                [Buffer.from("EnforcedOptions"), oappPda.toBuffer(), bufferDstEid],
                program.programId
            )

            const [peerPda] =  PublicKey.findProgramAddressSync(
                [Buffer.from("Peer"), oappPda.toBuffer(), bufferDstEid],
                program.programId
            )

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
            // =========================================================

            // 2. Setup Endpoint V2 settings
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
            
            // Message Library needs to be registered in the Endpoint for send and receive to work
            const [messageLibPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(MESSAGE_LIB_SEED, "utf8")],
                ulnProgram.programId
            )
            const [messageLibInfoPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(MESSAGE_LIB_SEED), messageLibPda.toBytes()],
                endpointProgram.programId
            )

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
        } catch(e) {
            console.log("Setup already previously completed")
        }
    })

    it('initializes vault', async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )
        
        // Only assertions. `initVault()` is already run in test setup
        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, DST_EID)
        assert.ok(vaultAuthority.solChainId.eq(new BN(12)))
    })

    it('resets vault', async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )

        assert.equal(vaultAuthority.orderDelivery, true)

        const resetVault = async (signer: Keypair) => {
            await program.methods 
                .resetVault()
                .accounts({
                    owner: signer.publicKey,
                    vaultAuthority: vaultAuthorityPda
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        await resetVault(wallet.payer)

        // Reinitialize the vault with new data
        await program.methods
            .initVault({
                owner: wallet.publicKey,
                orderDelivery: false, 
                dstEid: 43,           
                solChainId: new BN(13),
            })
            .accounts({
                signer: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc(confirmOptions)
    
        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.orderDelivery, false)
        assert.equal(vaultAuthority.dstEid, 43)
        assert.ok(vaultAuthority.solChainId.eq(new BN(13)))

        // FAILURE CASE - when vaultAuthority owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await resetVault(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Reset Vault should fail when vaultAuthority owner is not the signer")
    })

    it('initializes oapp', async () => {
        const [oappPda, oappBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("LzReceiveTypes"), oappPda.toBuffer()],
            program.programId
        )
        const [oappRegistryPda, oappRegistryBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp"), oappPda.toBuffer()],
            endpointProgram.programId
        )
        const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(EVENT_SEED)],
            endpointProgram.programId
        )
        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        try {
            await program.methods
                    .initOapp({
                    admin: wallet.publicKey,
                    endpointProgram: endpointProgram.programId,
                    usdcHash: usdcHash,
                    usdcMint: USDC_MINT
                })
                .accounts({
                    payer: wallet.publicKey,
                    oappConfig: oappPda,
                    lzReceiveTypes: lzReceiveTypesPda,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: wallet.publicKey,
                        isWritable: true,
                        isSigner: true,
                    },
                    {
                        pubkey: oappPda,
                        isWritable: false,
                        isSigner: false,
                    },
                    {
                        pubkey: oappRegistryPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: SystemProgram.programId,
                        isWritable: false,
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
            console.log("Already called in test setup")
        }

        const oappConfig = await program.account.oAppConfig.fetch(oappPda)
        const lzReceiveTypes = await program.account.oAppLzReceiveTypesAccounts.fetch(lzReceiveTypesPda)
        const oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)

        assert.equal(lzReceiveTypes.oappConfig.toString(), oappPda.toString())
        assert.equal(oappConfig.bump, oappBump)
        assert.deepEqual(oappConfig.usdcHash, usdcHash)
        // assert.equal(oappConfig.usdcMint.toString(), USDC_MINT.toString())
        assert.equal(oappConfig.endpointProgram.toString(), endpointProgram.programId.toString())
        assert.equal(oappConfig.admin.toString(), wallet.publicKey.toString())
        assert.equal(oappRegistry.delegate.toString(), wallet.publicKey.toString())
        assert.equal(oappRegistry.bump, oappRegistryBump)
    })

    it('reinitializes oapp', async () => {
        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("VaultAuthority")],
            program.programId
        )

        const [oappPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        await program.methods
            .resetOapp()
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda
            })
            .rpc(confirmOptions)

        await program.methods
            .reinitOapp({
                admin: wallet.publicKey,
                endpointProgram: endpointProgram.programId,
                usdcHash: usdcHash,
                usdcMint: USDC_MINT
            })
            .accounts({
                owner: wallet.publicKey,
                oappConfig: oappPda,
                vaultAuthority: vaultAuthorityPda,
                systemProgram: SystemProgram.programId
            })
            .signers([wallet.payer])
            .rpc(confirmOptions)
        
        const oappConfig = await program.account.oAppConfig.fetch(oappPda)
        assert.equal(oappConfig.admin.toString(), wallet.publicKey.toString())
        assert.equal(oappConfig.endpointProgram.toString(), endpointProgram.programId.toString())
        assert.equal(oappConfig.usdcMint.toString(), USDC_MINT.toString())
        assert.deepEqual(oappConfig.usdcHash, usdcHash)
    })

    it('resets oapp', async () => {
        await program.methods
            .resetOapp()
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappPda
            })
            .rpc(confirmOptions)
        
        let oappPdaDoesNotExist: boolean
        try {
            await program.account.oAppConfig.fetch(oappPda)
        } catch {
            oappPdaDoesNotExist = true
        }
        assert.isTrue(oappPdaDoesNotExist)

        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const reinitOapp = async (admin: Keypair) => {
            await program.methods
                .reinitOapp({
                    admin: admin.publicKey,
                    endpointProgram: endpointProgram.programId,
                    usdcHash: usdcHash,
                    usdcMint: USDC_MINT
                })
                .accounts({
                    owner: wallet.publicKey,
                    oappConfig: oappPda,
                    vaultAuthority: vaultAuthorityPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([admin])
                .rpc(confirmOptions)
        }
        
        await reinitOapp(wallet.payer)
        const oappConfig = await program.account.oAppConfig.fetch(oappPda)
        assert.isOk(oappConfig)
        
        // FAILURE CASE - when OApp admin is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await reinitOapp(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Reinit Oapp should fail when oApp config admin is not the signer")
    })

    it('reinitializes vault',  async () => {
        await program.methods
            .resetVault()
            .accounts({
                owner: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda
            })
            .rpc(confirmOptions)

        const reinitVault = async (signer: Keypair) => {
            await program.methods
                .reinitVault({
                    owner: wallet.publicKey,
                    dstEid: 12,
                    depositNonce: new BN('42'),
                    orderDelivery: true,
                    inboundNonce: new BN('42'),
                    solChainId: new BN('1')
                })
                .accounts({
                    vaultAuthority: vaultAuthorityPda,
                    admin: signer.publicKey,
                    oappConfig: oappPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        await reinitVault(wallet.payer)
        
        const vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, 12)
        assert.isTrue(vaultAuthority.depositNonce.eq(new BN('42')))
        assert.isTrue(vaultAuthority.inboundNonce.eq(new BN('42')))
        assert.isTrue(vaultAuthority.solChainId.eq(new BN('1')))

        // FAILURE CASE - when signer is not the VaultAuthority Owner
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await reinitVault(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "ReinitVault should fail when vaultAuthority owner is not the signer")
    }) 

    it('sets broker', async () => {
        const brokerHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const [allowedBrokerPda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from("Broker"), Buffer.from(brokerHash)],
            program.programId
        )

        const setBroker = async (signer: Keypair) => {
            await program.methods
                .setBroker({
                    brokerHash: brokerHash,
                    allowed: true
                })
                .accounts({
                    admin: signer.publicKey,
                    allowedBroker: allowedBrokerPda,
                    oappConfig: oappPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        await setBroker(wallet.payer)

        const allowedBroker = await program.account.allowedBroker.fetch(allowedBrokerPda)
        assert.equal(allowedBroker.allowed, true)
        assert.deepEqual(allowedBroker.brokerHash, brokerHash)
        assert.equal(allowedBroker.bump, bump)

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await setBroker(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Set Broker should fail when oApp config admin is not the signer")
    })

    it('sets token', async () => {
        const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const [allowedTokenPda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from("Token"), Buffer.from(tokenHash)],
            program.programId
        )

        const setToken = async(signer: Keypair) => {
            await program.methods
                .setToken({
                    mintAccount: USDC_MINT,
                    tokenHash: tokenHash,
                    allowed: true
                })
                .accounts({
                    admin: signer.publicKey,
                    allowedToken: allowedTokenPda,
                    mintAccount: USDC_MINT,
                    oappConfig: oappPda
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        await setToken(wallet.payer)

        const allowedToken = await program.account.allowedToken.fetch(allowedTokenPda)
        assert.equal(allowedToken.mintAccount.toString(), USDC_MINT.toString())
        assert.deepEqual(allowedToken.tokenHash, tokenHash)
        assert.equal(allowedToken.tokenDecimals, 6)
        assert.equal(allowedToken.allowed, true)
        assert.equal(allowedToken.bump, bump)

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await setToken(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Set Token should fail when oApp config is not the signer")
    })

    it('sets order delivery', async () => {
        assert.isFalse(vaultAuthority.orderDelivery)
        const setOrderDelivery = async (signer: Keypair) => {
            await program.methods
                .setOrderDelivery({
                    orderDelivery: true,
                    nonce: new BN(1)
                })
                .accounts({
                    owner: signer.publicKey,
                    vaultAuthority: vaultAuthorityPda
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        await setOrderDelivery(wallet.payer)

        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.isTrue(vaultAuthority.orderDelivery)
        assert.isTrue(vaultAuthority.inboundNonce.eq(new BN('1')))

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await setOrderDelivery(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Set Order Delivery should fail when vaultAuthority owner is not the signer")
    })

    it('sets peer', async () => {
        const buf = Buffer.alloc(4)
        buf.writeUInt32BE(DST_EID)
        const [peerPda, peerBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("Peer"), oappPda.toBuffer(), buf],
            program.programId
        )
        // Assertions only. `setPeer()` is called in the before() block.
        const peer = await program.account.peer.fetch(peerPda)
        assert.deepEqual(peer.address, PEER_HASH)
        assert.equal(peer.bump, peerBump)

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await program.methods
                .setPeer({
                    dstEid: ETHEREUM_EID,
                    peer: PEER_HASH
                })
                .accounts({
                    admin: nonAdmin.publicKey,
                    peer: peerPda,
                    oappConfig: oappPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([nonAdmin])
                .rpc(confirmOptions)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Transfer Admin should fail when oappConfig admin is not the signer")
    })

    it('sets rate limit', async () => {
        const bufferDstEid = Buffer.alloc(4)
        bufferDstEid.writeUInt32BE(DST_EID)
        const [peerPda] =  PublicKey.findProgramAddressSync(
            [Buffer.from("Peer"), oappPda.toBuffer(), bufferDstEid],
            program.programId
        )

        const setRateLimit = async (signer: Keypair) => {
            await program.methods
                .setRateLimit({
                    dstEid: DST_EID,
                    refillPerSecond: new BN('13'),
                    capacity: new BN('1000'),
                    enabled: true
                })
                .accounts({
                    admin: signer.publicKey,
                    oappConfig: oappPda,
                    peer: peerPda
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        await setRateLimit(wallet.payer)
        
        const peer = await program.account.peer.fetch(peerPda)
        assert.isTrue(peer.rateLimiter.capacity.eq(new BN('1000')))
        assert.isTrue(peer.rateLimiter.refillPerSecond.eq(new BN('13')))

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await setRateLimit(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Set Rate Limit should fail when oappConfig admin is not the signer")
    })

    it('sets enforced options', async () => {
        const buf = Buffer.alloc(4)
        buf.writeUInt32BE(DST_EID)
        const [efOptionsPda, efOptionsBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("EnforcedOptions"), oappPda.toBuffer(), buf],
            program.programId
        )

        const setEnforcedOptions = async (signer: Keypair) => {
            await program.methods
                .setEnforcedOptions({
                    dstEid: DST_EID,
                    send: Buffer.from([0, 3, 3]),
                    sendAndCall: Buffer.from([0, 3, 3])
                })
                .accounts({
                    admin: signer.publicKey,
                    oappConfig: oappPda,
                    enforcedOptions: efOptionsPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        await setEnforcedOptions(wallet.payer)

        // Assertions only. Test setup is done in the before() block.
        const enforcedOptions = await program.account.enforcedOptions.fetch(efOptionsPda)
        assert.isTrue(enforcedOptions.send.equals(Buffer.from([0, 3, 3])))
        assert.isTrue(enforcedOptions.sendAndCall.equals(Buffer.from([0, 3, 3])))
        assert.equal(enforcedOptions.bump, efOptionsBump)

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await setEnforcedOptions(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Set Enforced Options should fail when oappConfig admin is not the signer")
    })

    it('sets delegate', async () => {
        const [oappPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp")],
            program.programId
        )
        const [oappRegistryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("OApp"), oappPda.toBuffer()],
            endpointProgram.programId
        )
        const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from(EVENT_SEED)],
            endpointProgram.programId
        )

        const newDelegate = Keypair.generate().publicKey

        const setDelegate = async (newDelegate: PublicKey, admin: Keypair) => {
            await program.methods
                .setDelegate({
                    delegate: newDelegate
                })
                .accounts({
                    admin: admin.publicKey,
                    oappConfig: oappPda
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappPda,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappRegistryPda,
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
                .signers([admin])
                .rpc(confirmOptions)
        }
        
        await setDelegate(newDelegate, wallet.payer)
        const oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        assert.equal(oappRegistry.delegate.toString(), newDelegate.toString(), "Delegate should be changed")

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await setDelegate(Keypair.generate().publicKey, nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Set Delegate should fail when oApp config admin is not the signer")
    })

    it('transfers admin', async () => {
        const newAdmin = Keypair.generate()
        
        const transferAdmin = async (signer: Keypair) => {
            await program.methods
                .transferAdmin({
                    admin: newAdmin.publicKey
                })
                .accounts({
                    admin: wallet.publicKey,
                    oappConfig: oappPda
                })
                .rpc(confirmOptions)
        }
        await transferAdmin(wallet.payer)
        
        const oappConfig = await program.account.oAppConfig.fetch(oappPda)
        assert.equal(oappConfig.admin.toString(), newAdmin.publicKey.toString())

        // FAILURE CASE - when admin/owner is not the signer
        const nonAdmin = Keypair.generate()
        let failed
        try {
            await transferAdmin(nonAdmin)
        } catch(e) {
            failed = true
        }
        assert.isTrue(failed, "Transfer Admin should fail when oappConfig admin is not the signer")
    })
})