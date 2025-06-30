import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { createMint } from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js'
import { assert } from 'chai'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import * as utils from '../scripts/utils'
import {
    getBrokerPdaWithBuf,
    getEnforcedOptionsPda,
    getLzReceiveTypesPda,
    getOAppConfigPda,
    getOAppRegistryPda,
    getPeerPda,
    getTokenPdaWithBuf,
    getVaultAuthorityPda,
    getAccountListPda
} from '../scripts/utils'
import * as setup from './setup'
import * as helper from './helper'

describe('Test Solana-Vault configuration', function() {
    
    console.log("Configuration test")
    const { provider, wallet, endpointProgram, ulnProgram, solanaVault } = helper.prepareEnviroment()
    anchor.setProvider(provider)
    const attacker = Keypair.generate()
    // Create a mint authority for USDC
    const usdcMintAuthority = Keypair.generate()
    const endpointAdmin = wallet.payer
    const ORDERLY_EID = helper.ORDERLY_EID
    const DST_EID = ORDERLY_EID
    const PEER_ADDRESS = Array.from(helper.PEER_ADDRESS)
    console.log("PEER_ADDRESS", PEER_ADDRESS)
    let vaultAuthority
    let oappConfigPda: PublicKey
    const vaultAuthorityPda = getVaultAuthorityPda(solanaVault.programId)
    const newVaultOwner = Keypair.generate();
    const tokenHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    const brokerHash = tokenHash
    let USDC_MINT: PublicKey

    before(async () => {

        console.log("Start configuration test")
        
        USDC_MINT = await createMint(
            provider.connection,
            wallet.payer,
            usdcMintAuthority.publicKey,
            null,
            6,
            Keypair.generate(),
            setup.confirmOptions
        )
        console.log("✅ Deploy USDC coin")

        oappConfigPda = (await setup.initOapp(wallet, solanaVault, endpointProgram)).oappConfigPda
        console.log("✅ Init Oapp")

        await setup.initVault(wallet, solanaVault, helper.ORDERLY_EID, helper.SOLANA_CHAIN_ID)
        console.log("✅ Set Vault")
        
        await setup.initPeer(wallet, solanaVault, oappConfigPda, DST_EID, PEER_ADDRESS)
        console.log("✅ Set Peer")
            
        await setup.initEnforcedOptions(wallet, solanaVault, oappConfigPda, DST_EID)
        console.log("✅ Set Enforced Options")

        // const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
        await setup.initEndpoint(endpointAdmin, endpointProgram)
        console.log("✅ Init Endpoint Mock")
        
        const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
        await setup.registerLibrary(wallet, ulnProgram, endpointProgram, messageLibPda, messageLibInfoPda)
        console.log("✅ Register Library")
    
        const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
        const sendLibraryConfigPda = utils.getSendLibConfigPda(oappConfigPda, DST_EID)
        const defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(DST_EID)
        // Need to initialize the Send Library before clear() and send() can be called in the Endpoint
        await setup.initSendLibrary(wallet, endpointProgram, oappConfigPda, oappRegistryPda, sendLibraryConfigPda, DST_EID)
        console.log("✅ Init Send Library")
        
        await setup.initDefaultSendLibrary(wallet, endpointProgram, DST_EID, messageLibPda, messageLibInfoPda)
        console.log("✅ Init Default Send Library")

        await setup.initUln(wallet, ulnProgram, messageLibPda, helper.SOLANA_EID)
        console.log("✅ Initialized ULN")

        const noncePda = utils.getNoncePda(oappConfigPda, DST_EID, helper.PEER_ADDRESS)
        const pendingInboundNoncePda = utils.getPendingInboundNoncePda(oappConfigPda, DST_EID, helper.PEER_ADDRESS)
        
        await setup.initNonce(wallet, endpointProgram, oappConfigPda, oappRegistryPda, noncePda, pendingInboundNoncePda, DST_EID, PEER_ADDRESS)
        console.log("✅ Initialized Nonce")
    
        await provider.connection.requestAirdrop(attacker.publicKey, 1e9)

    })

    it('Set vault authority', async () => {
        
        const vaultAuthorityPda = getVaultAuthorityPda(solanaVault.programId)

        // Only assertions. `initVault()` is already run in test setup
        let vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, ORDERLY_EID)
        assert.equal(vaultAuthority.solChainId.eq(new BN(helper.SOLANA_CHAIN_ID)), true)
        console.log("✅ Checked Vault Authority state")
    
        // FAILURE CASE - when vaultAuthority owner is not the signer
        
        console.log("🥷 Attacker trying to set Vault Authority")
        let setVaultParams, setVaultAccounts
        try {
            setVaultParams = {
                owner: newVaultOwner.publicKey,
                depositNonce: new BN(1),
                orderDelivery: false,
                inboundNonce: new BN(1),
                dstEid: 43,
                solChainId: new BN(13),
            }
            setVaultAccounts = {
                admin:attacker.publicKey,
                vaultAuthority: vaultAuthorityPda,
                oappConfig: oappConfigPda,
            }
            await setup.setVault(attacker, solanaVault, setVaultParams, setVaultAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Vault Authority")
        }
        
        // Admin trying to set Vault Authority
        setVaultParams = {
            owner: newVaultOwner.publicKey,
            depositNonce: new BN(0),
            orderDelivery: false,
            inboundNonce: new BN(0),
            dstEid: ORDERLY_EID,
            solChainId: new BN(helper.SOLANA_CHAIN_ID),
        }

        setVaultAccounts.admin = wallet.publicKey
        await setup.setVault(wallet.payer, solanaVault, setVaultParams, setVaultAccounts)
        
        // check vault authority state
        vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), newVaultOwner.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, false)
        assert.equal(vaultAuthority.dstEid, ORDERLY_EID)
        assert.equal(vaultAuthority.solChainId.eq(new BN(helper.SOLANA_CHAIN_ID)), true)
        console.log("✅ Owner set Vault Authority")

        // Admin to reset vault authority (reset to original owner)
        setVaultParams.owner = wallet.publicKey
        setVaultParams.orderDelivery = true

        await setup.setVault(wallet.payer, solanaVault, setVaultParams, setVaultAccounts)
   
        vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        console.log("✅ Reset Vault Authority")
    })

    it('Initialize oapp', async () => {
        const lzReceiveTypesPda = getLzReceiveTypesPda(solanaVault.programId, oappConfigPda)
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)
        const oappConfig = await solanaVault.account.oAppConfig.fetch(oappConfigPda)
        const lzReceiveTypes = await solanaVault.account.oAppLzReceiveTypesAccounts.fetch(lzReceiveTypesPda)
        const oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)

        assert.equal(lzReceiveTypes.oappConfig.toString(), oappConfigPda.toString())
        assert.equal(oappConfig.endpointProgram.toString(), endpointProgram.programId.toString())
        assert.equal(oappConfig.admin.toString(), wallet.publicKey.toString())
        assert.equal(oappRegistry.delegate.toString(), wallet.publicKey.toString())
        console.log("✅ Checked OAPP Config state")
    })

    it('Set account list', async () => {

        const lzReceiveTypesPda = getLzReceiveTypesPda(solanaVault.programId, oappConfigPda)
        const accountListPda = getAccountListPda(solanaVault.programId, oappConfigPda)
        const tokenPda = getTokenPdaWithBuf(solanaVault.programId, tokenHash)
        const brokerPda = getBrokerPdaWithBuf(solanaVault.programId, brokerHash)

        console.log("🥷 Attacker trying to set AccountList")
        let setAccountListParams, setAccountListAccounts
        
        try {
            setAccountListParams = {
                accountList: accountListPda,
                usdcPda: tokenPda,
                usdcMint: USDC_MINT,
                woofiProPda: brokerPda
            }
            setAccountListAccounts = {
                admin:attacker.publicKey,
                oappConfig: oappConfigPda,
                lzReceiveTypes: lzReceiveTypesPda,
                accountsList: accountListPda,
                systemProgram: SystemProgram.programId
            }
            await setup.setAccountList(attacker, solanaVault, setAccountListParams, setAccountListAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set AccountList")
            // console.log(e)
        }

        // Admin trying to set AccountList
        setAccountListAccounts.admin = wallet.publicKey
        await setup.setAccountList(wallet.payer, solanaVault, setAccountListParams, setAccountListAccounts)
        const accountListData = await solanaVault.account.accountList.fetch(accountListPda)
        assert.equal(accountListData.usdcPda.toString(), tokenPda.toString())
        assert.equal(accountListData.usdcMint.toString(), USDC_MINT.toString())
        assert.equal(accountListData.woofiProPda.toString(), brokerPda.toString())
        console.log("✅ Admin Set AccountList")
    })


    
    it('Set broker', async () => {
        const brokerHash = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        const allowedBrokerPda = getBrokerPdaWithBuf(solanaVault.programId, brokerHash)

        console.log("🥷 Attacker trying to set Broker")
        let setBrokerParams, setBrokerAccounts
        try {
            setBrokerParams = {
                brokerHash: brokerHash,
                allowed: true
            }
            setBrokerAccounts = {
                admin:attacker.publicKey,
                allowedBroker: allowedBrokerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId
            }
            await setup.setBroker(attacker, solanaVault, setBrokerParams, setBrokerAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Broker")
        }

        setBrokerAccounts.admin = wallet.publicKey
        await setup.setBroker(wallet.payer, solanaVault, setBrokerParams, setBrokerAccounts)
        const allowedBroker = await solanaVault.account.allowedBroker.fetch(allowedBrokerPda)
        assert.equal(allowedBroker.allowed, true)
        assert.deepEqual(allowedBroker.brokerHash, brokerHash)
        assert.isOk(allowedBroker.bump)
        console.log("✅ Set Broker")
    })

    it('Set token', async () => {
        const allowedTokenPda = getTokenPdaWithBuf(solanaVault.programId, tokenHash)

        console.log("🥷 Attacker trying to set Token")
        let setTokenParams, setTokenAccounts
        try {
            setTokenParams = {
                mintAccount: USDC_MINT,
                tokenHash: tokenHash,
                allowed: true
            }
            setTokenAccounts = {
                admin:attacker.publicKey,
                allowedToken: allowedTokenPda,
                mintAccount: USDC_MINT,
                oappConfig: oappConfigPda
            }
            await setup.setToken(attacker, solanaVault, setTokenParams, setTokenAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized");
            console.log("🥷 Attacker failed to set Token")
        }

        setTokenAccounts.admin = wallet.publicKey
        await setup.setToken(wallet.payer, solanaVault, setTokenParams, setTokenAccounts)
        const allowedToken = await solanaVault.account.allowedToken.fetch(allowedTokenPda)
        assert.equal(allowedToken.mintAccount.toString(), USDC_MINT.toString())
        assert.deepEqual(allowedToken.tokenHash, tokenHash)
        assert.equal(allowedToken.tokenDecimals, 6)
        assert.equal(allowedToken.allowed, true)
        assert.isOk(allowedToken.bump)
        console.log("✅ Set Token")
        
    })

    it('Set order delivery', async () => {
        
        console.log("🥷 Attacker trying to set Order Delivery")
        let setOrderDeliveryParams, setOrderDeliveryAccounts
        try {
            setOrderDeliveryParams = {
                orderDelivery: true,
                nonce: new BN(0)
            }
            setOrderDeliveryAccounts = {
                owner: attacker.publicKey,
                vaultAuthority: vaultAuthorityPda
            }
            await setup.setOrderDelivery(attacker, solanaVault, setOrderDeliveryParams, setOrderDeliveryAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "InvalidVaultOwner")
            console.log("🥷 Attacker failed to set Order Delivery")
        }

        setOrderDeliveryAccounts.owner = wallet.publicKey
        await setup.setOrderDelivery(wallet.payer, solanaVault, setOrderDeliveryParams, setOrderDeliveryAccounts)
        
        vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.isTrue(vaultAuthority.orderDelivery)
        assert.isTrue(vaultAuthority.inboundNonce.eq(new BN('0')))   
        console.log("✅ Set Order Delivery")     
    })

    it('Set peer', async () => {
       
        const peerPda = getPeerPda(solanaVault.programId, oappConfigPda, DST_EID)
        let peer = await solanaVault.account.peer.fetch(peerPda)
        console.log("peer", peer)
        assert.deepEqual(peer.address, PEER_ADDRESS)
        assert.isOk(peer.bump)
        console.log("hi")

        // FAILURE CASE - when admin/owner is not the signer
        console.log("🥷 Attacker trying to set Peer")
        let setPeerParams, setPeerAccounts
        try {
            setPeerParams = {
                dstEid: DST_EID,
                peer: PEER_ADDRESS
            }
            setPeerAccounts = {
                admin: attacker.publicKey,
                peer: peerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId
            }
            await setup.setPeer(attacker, solanaVault, setPeerParams, setPeerAccounts)
        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Peer")
        }

        setPeerAccounts.admin = wallet.publicKey
        await setup.setPeer(wallet.payer, solanaVault, setPeerParams, setPeerAccounts)
        peer = await solanaVault.account.peer.fetch(peerPda)
        assert.deepEqual(peer.address, PEER_ADDRESS)
        console.log("✅ Set Peer")
    })

    it('Sets rate limit', async () => {
        const peerPda = getPeerPda(solanaVault.programId, oappConfigPda, DST_EID)

        console.log("🥷 Attacker trying to set Rate Limit")
        let setRateLimitParams, setRateLimitAccounts
        try {
            setRateLimitParams = {
                dstEid: DST_EID,
                refillPerSecond: new BN('13'),
                capacity: new BN('1000'),
                enabled: true
            }
            setRateLimitAccounts = {
                admin: attacker.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda
            }
            await setup.setRateLimit(attacker, solanaVault, setRateLimitParams, setRateLimitAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Rate Limit")
        }

        setRateLimitAccounts.admin = wallet.publicKey
        await setup.setRateLimit(wallet.payer, solanaVault, setRateLimitParams, setRateLimitAccounts)
        
        const peer = await solanaVault.account.peer.fetch(peerPda)
        assert.isTrue(peer.rateLimiter.capacity.eq(new BN('1000')))
        assert.isTrue(peer.rateLimiter.refillPerSecond.eq(new BN('13')))
        console.log("✅ Set Rate Limit")        
     
    })

    it('Set enforced options', async () => {
        
        const efOptionsPda = getEnforcedOptionsPda(solanaVault.programId, oappConfigPda, DST_EID)
        
        console.log("🥷 Attacker trying to set Enforced Options")
        let setEnforcedOptionsParams, setEnforcedOptionsAccounts
        try {
            setEnforcedOptionsParams = {
                dstEid: DST_EID,
                send: Buffer.from([0, 3, 3]),
                sendAndCall: Buffer.from([0, 3, 3])
            }
            setEnforcedOptionsAccounts = {
                admin: attacker.publicKey,
                oappConfig: oappConfigPda,
                enforcedOptions: efOptionsPda,
                systemProgram: SystemProgram.programId
            }
            await setup.setEnforcedOptions(attacker, solanaVault, setEnforcedOptionsParams, setEnforcedOptionsAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set EnforcedOptions")
        }

        setEnforcedOptionsAccounts.admin = wallet.publicKey
        await setup.setEnforcedOptions(wallet.payer, solanaVault, setEnforcedOptionsParams, setEnforcedOptionsAccounts)

        const enforcedOptions = await solanaVault.account.enforcedOptions.fetch(efOptionsPda)
        assert.isTrue(enforcedOptions.send.equals(Buffer.from([0, 3, 3])))
        assert.isTrue(enforcedOptions.sendAndCall.equals(Buffer.from([0, 3, 3])))
        assert.isOk(enforcedOptions.bump)

    })

    it('Set delegate', async () => {
        
        const newDelegate = Keypair.generate()
        const oappRegistryPda = getOAppRegistryPda(oappConfigPda)

        console.log("🥷 Attacker trying to set Delegate")
        let setDelegateParams, setDelegateAccounts
        setDelegateParams = {
            delegate: newDelegate.publicKey
        }
        setDelegateAccounts = {
            admin: attacker.publicKey,
            oappConfig: oappConfigPda
        }
        try {
            await setup.setDelegate(attacker, solanaVault, endpointProgram, setDelegateParams, setDelegateAccounts)
        } catch(e) {
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to set Delegate")
        }
        
        setDelegateAccounts.admin = wallet.publicKey
        await setup.setDelegate(wallet.payer, solanaVault, endpointProgram, setDelegateParams, setDelegateAccounts)
        
        let oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        assert.equal(oappRegistry.delegate.toString(), newDelegate.publicKey.toString(), "Delegate should be changed")

        let delegateOnchain = await OftTools.getDelegate(provider.connection, oappConfigPda, endpointProgram.programId)
        assert.equal(delegateOnchain.toString(), newDelegate.publicKey.toString())

        // Admin trying to reset Delegate
        setDelegateAccounts.admin = wallet.publicKey
        setDelegateParams.delegate = wallet.publicKey
       
        await setup.setDelegate(wallet.payer, solanaVault, endpointProgram, setDelegateParams, setDelegateAccounts)
        
        oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        assert.equal(oappRegistry.delegate.toString(), wallet.publicKey.toString(), "Delegate should be reset")

        delegateOnchain = await OftTools.getDelegate(provider.connection, oappConfigPda, endpointProgram.programId)
        assert.equal(delegateOnchain.toString(), wallet.publicKey.toString())

        console.log("✅ Set Delegate")
    })

    it('Transfer admin', async () => {
        const newAdmin = Keypair.generate()
        const oappConfigPda = getOAppConfigPda(solanaVault.programId)
        console.log("🥷 Attacker trying to transfer Admin")
        let transferAdminParams, transferAdminAccounts
        try {
            transferAdminParams = {
                admin: newAdmin.publicKey
            }
            transferAdminAccounts = {
                admin: attacker.publicKey,
                oappConfig: oappConfigPda
            }
        } catch(e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, "Unauthorized")
            console.log("🥷 Attacker failed to transfer Admin")
        }

        transferAdminAccounts.admin = wallet.publicKey
        await setup.transferAdmin(wallet.payer, solanaVault, transferAdminParams, transferAdminAccounts)
        let oappConfigData = await solanaVault.account.oAppConfig.fetch(oappConfigPda)
        assert.equal(oappConfigData.admin.toString(), newAdmin.publicKey.toString())

        // Admin trying to reset Admin
        transferAdminAccounts.admin = newAdmin.publicKey
        transferAdminParams.admin = wallet.publicKey
        await setup.transferAdmin(newAdmin, solanaVault, transferAdminParams, transferAdminAccounts)
        oappConfigData = await solanaVault.account.oAppConfig.fetch(oappConfigPda)
        assert.equal(oappConfigData.admin.toString(), wallet.publicKey.toString())

        console.log("✅ Transfer Admin")
    })
})