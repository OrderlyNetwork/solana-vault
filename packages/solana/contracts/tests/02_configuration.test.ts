import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from './types/endpoint'
import { createMint } from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { assert } from 'chai'
import endpointIdl from './idl/endpoint.json'
import {
    getBrokerPdaWithBuf,
    getEndpointSettingPda,
    getEnforcedOptionsPda,
    getEventAuthorityPda,
    getLzReceiveTypesPda,
    getMessageLibInfoPda,
    getMessageLibPda,
    getOAppConfigPda,
    getOAppRegistryPda,
    getPeerPda,
    getTokenPdaWithBuf,
    getVaultAuthorityPda,
    getAccountListPda
} from '../scripts/utils'
import { MainnetV2EndpointId } from '@layerzerolabs/lz-definitions'
import { initOapp, setVault, confirmOptions } from './setup'
import { token } from '@coral-xyz/anchor/dist/cjs/utils'

let USDC_MINT: PublicKey
const LAYERZERO_ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
const ETHEREUM_EID = MainnetV2EndpointId.ETHEREUM_V2_MAINNET
describe('Test Solana-Vault configuration', function() {
    
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env()
    const wallet = provider.wallet as anchor.Wallet
    anchor.setProvider(provider)
    const attacker = Keypair.generate()
    const program = anchor.workspace.SolanaVault as Program<SolanaVault>
    const endpointProgram = new Program(endpointIdl as Idl, LAYERZERO_ENDPOINT_PROGRAM_ID, provider) as Program<Endpoint>
    const ulnProgram = anchor.workspace.Uln as Program<Uln>
    // Create a mint authority for USDC
    const usdcMintAuthority = Keypair.generate()
    const endpointAdmin = wallet.payer
    const DST_EID = ETHEREUM_EID
    const PEER_ADDRESS = Array.from(wallet.publicKey.toBytes())
    let vaultAuthority
    let oappConfigPda: PublicKey
    const vaultAuthorityPda = getVaultAuthorityPda(program.programId)
    const newVaultOwner = Keypair.generate();
    const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    const brokerHash = tokenHash

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
        console.log("✅ Deploy USDC coin")
        
        oappConfigPda = (await initOapp(wallet, program, endpointProgram, USDC_MINT)).oappConfigPda
        vaultAuthority = (await setVault(wallet, program, DST_EID)).vaultAuthority
        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappConfigPda, DST_EID)
        const peerPda =  getPeerPda(program.programId, oappConfigPda, DST_EID)
        try {
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
        } catch(e) {
            console.log("Peer already set")
            // console.log(e)
        }

        try {
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
        } catch(e) {
            console.log("Enforced Options already set")
            // console.log(e)
        }

        const endpointPda = getEndpointSettingPda(endpointProgram.programId)
        try {
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
            
        } catch(e) {
            console.log("Endpoint already initialized")
            // console.log(e)
        }
        const messageLibPda = getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = getMessageLibInfoPda(messageLibPda, ulnProgram.programId)
        try {
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
            
            console.log("Message Library already registered")
            // console.log(e)
        }


        const lzReceiveTypesPda = getLzReceiveTypesPda(program.programId, oappConfigPda)
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        const eventAuthorityPda = getEventAuthorityPda()
        const accountListPda = getAccountListPda(program.programId, oappConfigPda)
        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

        try {
            await program.methods
                    .initOapp({
                    admin: wallet.publicKey,
                    endpointProgram: endpointProgram.programId,
                    accountList: accountListPda
                })
                .accounts({
                    payer: wallet.publicKey,
                    oappConfig: oappConfigPda,
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
                        pubkey: oappConfigPda,
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
            console.log("✅ Oapp already initialized")
            // console.log(e)
        }

        console.log("✅ Setup already done")

        // Get some SOL for attacker from faucet 
        await provider.connection.requestAirdrop(attacker.publicKey, 1e9)

    })

    it('Set vault authority', async () => {
        
        const vaultAuthorityPda = getVaultAuthorityPda(program.programId)

        // Only assertions. `initVault()` is already run in test setup
        let vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, DST_EID)
        assert.equal(vaultAuthority.solChainId.eq(new BN(12)), true)
        console.log("✅ Checked Vault Authority state")
    
        // FAILURE CASE - when vaultAuthority owner is not the signer
        
        console.log("🥷 Attacker trying to set Vault Authority")
        try {
            await program.methods
                .setVault({
                    owner: newVaultOwner.publicKey,
                    depositNonce: new BN(1),
                    orderDelivery: false,
                    inboundNonce: new BN(1),
                    dstEid: 43,
                    solChainId: new BN(13),
                })
                .accounts({
                    admin:attacker.publicKey,
                    vaultAuthority: vaultAuthorityPda,
                    oappConfig: oappConfigPda,
                })
                .signers([attacker])
                .rpc(confirmOptions)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Vault Authority")
        }
        
       
        await program.methods 
        .setVault({
            owner: newVaultOwner.publicKey,
            depositNonce: new BN(1),
            orderDelivery: false,
            inboundNonce: new BN(1),
            dstEid: 43,
            solChainId: new BN(13),
        })
        .accounts({
            admin:wallet.publicKey,
            vaultAuthority: vaultAuthorityPda,
            oappConfig: oappConfigPda,
        })
        .signers([wallet.payer])
        .rpc(confirmOptions)

        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), newVaultOwner.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, false)
        assert.equal(vaultAuthority.dstEid, 43)
        assert.equal(vaultAuthority.solChainId.eq(new BN(13)), true)
        console.log("✅ Owner set Vault Authority")
    })

    it('Initialize oapp', async () => {
        const lzReceiveTypesPda = getLzReceiveTypesPda(program.programId, oappConfigPda)
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        const usdcHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const oappConfig = await program.account.oAppConfig.fetch(oappConfigPda)
        const lzReceiveTypes = await program.account.oAppLzReceiveTypesAccounts.fetch(lzReceiveTypesPda)
        const oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)

        assert.equal(lzReceiveTypes.oappConfig.toString(), oappConfigPda.toString())
        assert.equal(oappConfig.endpointProgram.toString(), endpointProgram.programId.toString())
        assert.equal(oappConfig.admin.toString(), wallet.publicKey.toString())
        assert.equal(oappRegistry.delegate.toString(), wallet.publicKey.toString())
        console.log("✅ Checked OAPP Config state")
    })

    it('Set account list', async () => {

        const lzReceiveTypesPda = getLzReceiveTypesPda(program.programId, oappConfigPda)
        const accountListPda = getAccountListPda(program.programId, oappConfigPda)
        const tokenPda = getTokenPdaWithBuf(program.programId, tokenHash)
        const brokerPda = getBrokerPdaWithBuf(program.programId, brokerHash)

        console.log("🥷 Attacker trying to set AccountList")
        const seAccountList = async (signer: Keypair) => {
            await program.methods
                .setAccountList({
                    accountList: accountListPda,
                    usdcPda: tokenPda,
                    usdcMint: USDC_MINT,
                    woofiProPda: brokerPda
                })
                .accounts({
                    admin: signer.publicKey,
                    oappConfig: oappConfigPda,
                    lzReceiveTypes: lzReceiveTypesPda,
                    accountsList: accountListPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([signer])
                .rpc(confirmOptions)
        }

        try {
            await seAccountList(attacker)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set AccountList")
            // console.log(e)
        }

        await seAccountList(wallet.payer)
        const accountListData = await program.account.accountList.fetch(accountListPda)
        assert.equal(accountListData.usdcPda.toString(), tokenPda.toString())
        assert.equal(accountListData.usdcMint.toString(), USDC_MINT.toString())
        assert.equal(accountListData.woofiProPda.toString(), brokerPda.toString())
        console.log("✅ Set AccountList")
    })


    
    it('Set broker', async () => {
        const brokerHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const allowedBrokerPda = getBrokerPdaWithBuf(program.programId, brokerHash)

        const setBroker = async (signer: Keypair) => {
            await program.methods
                .setBroker({
                    brokerHash: brokerHash,
                    allowed: true
                })
                .accounts({
                    admin: signer.publicKey,
                    allowedBroker: allowedBrokerPda,
                    oappConfig: oappConfigPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([signer])
                .rpc(confirmOptions)
        }

        console.log("🥷 Attacker trying to set Broker")
        try {
            await setBroker(attacker)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Broker")
            // console.log(e)
        }

        await setBroker(wallet.payer)
        const allowedBroker = await program.account.allowedBroker.fetch(allowedBrokerPda)
        assert.equal(allowedBroker.allowed, true)
        assert.deepEqual(allowedBroker.brokerHash, brokerHash)
        assert.isOk(allowedBroker.bump)
        console.log("✅ Set Broker")
    })

    it('Set token', async () => {
        const allowedTokenPda = getTokenPdaWithBuf(program.programId, tokenHash)

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
                    oappConfig: oappConfigPda
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        console.log("🥷 Attacker trying to set Token")
        try {
            await setToken(attacker)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized");
            console.log("🥷 Attacker failed to set Token")
        }
        await setToken(wallet.payer)
        const allowedToken = await program.account.allowedToken.fetch(allowedTokenPda)
        assert.equal(allowedToken.mintAccount.toString(), USDC_MINT.toString())
        assert.deepEqual(allowedToken.tokenHash, tokenHash)
        assert.equal(allowedToken.tokenDecimals, 6)
        assert.equal(allowedToken.allowed, true)
        assert.isOk(allowedToken.bump)
        console.log("✅ Set Token")
        
    })

    it('Set order delivery', async () => {
        
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

        console.log("🥷 Attacker trying to set Order Delivery")
        try {
            await setOrderDelivery(attacker)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "InvalidVaultOwner")
            console.log("🥷 Attacker failed to set Order Delivery")
        }

        await setOrderDelivery(newVaultOwner)
        vaultAuthority = await program.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.isTrue(vaultAuthority.orderDelivery)
        assert.isTrue(vaultAuthority.inboundNonce.eq(new BN('1')))   
        console.log("✅ Set Order Delivery")     
    })

    it('Set peer', async () => {
        const peerPda = getPeerPda(program.programId, oappConfigPda, DST_EID)
        // Assertions only. `setPeer()` is called in the before() block.
        let peer = await program.account.peer.fetch(peerPda)
        assert.deepEqual(peer.address, PEER_ADDRESS)
        assert.isOk(peer.bump)

        const setPeer = async (signer: Keypair) => {
            await program.methods
            .setPeer({
                dstEid: ETHEREUM_EID,
                peer: PEER_ADDRESS
            })
            .accounts({
                admin: signer.publicKey,
                peer: peerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId
            })
            .signers([signer])
            .rpc(confirmOptions)
        }
        // FAILURE CASE - when admin/owner is not the signer
        console.log("🥷 Attacker trying to set Peer")
        try {
            await setPeer(attacker)
        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Peer")
        }

        await setPeer(wallet.payer)
        peer = await program.account.peer.fetch(peerPda)
        assert.deepEqual(peer.address, PEER_ADDRESS)
        console.log("✅ Set Peer")
    })

    it('Sets rate limit', async () => {
        const peerPda = getPeerPda(program.programId, oappConfigPda, DST_EID)
        
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
                    oappConfig: oappConfigPda,
                    peer: peerPda
                })
                .signers([signer])
                .rpc(confirmOptions)
        }

        console.log("🥷 Attacker trying to set Rate Limit")
        try {
            await setRateLimit(attacker)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Rate Limit")
        }

        await setRateLimit(wallet.payer)
        
        const peer = await program.account.peer.fetch(peerPda)
        assert.isTrue(peer.rateLimiter.capacity.eq(new BN('1000')))
        assert.isTrue(peer.rateLimiter.refillPerSecond.eq(new BN('13')))
        console.log("✅ Set Rate Limit")        
     
    })

    it('Set enforced options', async () => {
        
        const efOptionsPda = getEnforcedOptionsPda(program.programId, oappConfigPda, DST_EID)
        
        const setEnforcedOptions = async (signer: Keypair) => {
            await program.methods
                .setEnforcedOptions({
                    dstEid: DST_EID,
                    send: Buffer.from([0, 3, 3]),
                    sendAndCall: Buffer.from([0, 3, 3])
                })
                .accounts({
                    admin: signer.publicKey,
                    oappConfig: oappConfigPda,
                    enforcedOptions: efOptionsPda,
                    systemProgram: SystemProgram.programId
                })
                .signers([signer])
                .rpc(confirmOptions)
        }
        console.log("🥷 Attacker trying to set Enforced Options")
        try {
            await setEnforcedOptions(attacker)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set EnforcedOptions")
        }

        await setEnforcedOptions(wallet.payer)
        // Assertions only. Test setup is done in the before() block.
        const enforcedOptions = await program.account.enforcedOptions.fetch(efOptionsPda)
        assert.isTrue(enforcedOptions.send.equals(Buffer.from([0, 3, 3])))
        assert.isTrue(enforcedOptions.sendAndCall.equals(Buffer.from([0, 3, 3])))
        assert.isOk(enforcedOptions.bump)

    })

    it('Set delegate', async () => {
        const oappConfigPda = getOAppConfigPda(program.programId)
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        const eventAuthorityPda = getEventAuthorityPda()
        const newDelegate = Keypair.generate().publicKey

        const setDelegate = async (newDelegate: PublicKey, admin: Keypair) => {
            await program.methods
                .setDelegate({
                    delegate: newDelegate
                })
                .accounts({
                    admin: admin.publicKey,
                    oappConfig: oappConfigPda
                })
                .remainingAccounts([
                    {
                        pubkey: endpointProgram.programId,
                        isWritable: true,
                        isSigner: false,
                    },
                    {
                        pubkey: oappConfigPda,
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

        console.log("🥷 Attacker trying to set Delegate")
        try {
            await setDelegate(Keypair.generate().publicKey, attacker)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Delegate")
        }
        
        await setDelegate(newDelegate, wallet.payer)
        const oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        assert.equal(oappRegistry.delegate.toString(), newDelegate.toString(), "Delegate should be changed")
        console.log("✅ Set Delegate")
    })

    it('Transfer admin', async () => {
        const newAdmin = Keypair.generate()
        
        const transferAdmin = async (signer: Keypair) => {
            await program.methods
                .transferAdmin({
                    admin: newAdmin.publicKey
                })
                .accounts({
                    admin: signer.publicKey,
                    oappConfig: oappConfigPda
                })
                .signers([signer])
                .rpc(confirmOptions)
        }

        console.log("🥷 Attacker trying to transfer Admin")
        try {
            await transferAdmin(attacker)
        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to transfer Admin")
        }

        await transferAdmin(wallet.payer)
        const oappConfig = await program.account.oAppConfig.fetch(oappConfigPda)
        assert.equal(oappConfig.admin.toString(), newAdmin.publicKey.toString())
        console.log("✅ Transfer Admin")
    })
})