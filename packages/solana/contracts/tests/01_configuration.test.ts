import * as anchor from '@coral-xyz/anchor'
import { BN } from '@coral-xyz/anchor'
import { createMint, NATIVE_MINT } from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { assert } from 'chai'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import * as utils from '../scripts/utils'
import * as constants from '../scripts/constants'
import * as setup from './setup'
import * as helper from './helper'

describe('Test Solana-Vault configuration', function () {
    console.log('Configuration test')
    const { provider, wallet, endpointProgram, ulnProgram, solanaVault } = helper.prepareEnviroment()
    anchor.setProvider(provider)
    const attacker = Keypair.generate()
    // Create a mint authority for USDC
    const tokenMintAuthority = wallet.payer
    const tokenFreezeAuthority = wallet.payer
    const endpointAdmin = wallet.payer
    const vaultOwner = wallet.payer
    const oappAdmin = wallet.payer
    const ORDERLY_EID = helper.ORDERLY_EID
    const DST_EID = ORDERLY_EID
    const PEER_ADDRESS = Array.from(helper.PEER_ADDRESS)
    let vaultAuthority
    let oappConfigPda: PublicKey
    const vaultAuthorityPda = utils.getVaultAuthorityPda(solanaVault.programId)
    const newVaultOwner = Keypair.generate()
    const usdcTokenHash = helper.getTokenHash(helper.USDC_SYMBOL)
    const usdtTokenHash = helper.getTokenHash(helper.USDT_SYMBOL)
    const wsolTokenHash = helper.getTokenHash(helper.WSOL_SYMBOL)
    const solTokenHash = helper.getTokenHash(helper.SOL_SYMBOL)
    const woofiBrokerHash = helper.getBrokerHash(helper.WOOFI_PRO_BROKER_ID)
    let USDC_MINT: PublicKey
    let USDT_MINT: PublicKey

    before(async () => {
        console.log('Start configuration test')

        USDC_MINT = await createMint(
            provider.connection,
            wallet.payer,
            tokenMintAuthority.publicKey,
            tokenFreezeAuthority.publicKey,
            constants.TOKEN_DECIMALS.USDC,
            helper.USDC_KEY,
            setup.confirmOptions
        )
        console.log('✅ Deploy USDC coin')

        USDT_MINT = await createMint(
            provider.connection,
            wallet.payer,
            tokenMintAuthority.publicKey,
            tokenFreezeAuthority.publicKey,
            constants.TOKEN_DECIMALS.USDT,
            helper.USDT_KEY,
            setup.confirmOptions
        )
        console.log('✅ Deploy USDT coin')

        oappConfigPda = (await setup.initOapp(wallet, solanaVault, endpointProgram)).oappConfigPda
        console.log('✅ Init Oapp')

        await setup.initVault(wallet, solanaVault, helper.ORDERLY_EID, helper.SOLANA_CHAIN_ID)
        console.log('✅ Set Vault')

        await setup.initPeer(wallet, solanaVault, oappConfigPda, DST_EID, PEER_ADDRESS)
        console.log('✅ Set Peer')

        await setup.initEnforcedOptions(wallet, solanaVault, oappConfigPda, DST_EID)
        console.log('✅ Set Enforced Options')

        // const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
        await setup.initEndpoint(endpointAdmin, endpointProgram)
        console.log('✅ Init Endpoint Mock')

        const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
        const messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
        await setup.registerLibrary(wallet, ulnProgram, endpointProgram, messageLibPda, messageLibInfoPda)
        console.log('✅ Register Library')

        const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
        const sendLibraryConfigPda = utils.getSendLibConfigPda(oappConfigPda, DST_EID)
        const defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(DST_EID)
        // Need to initialize the Send Library before clear() and send() can be called in the Endpoint
        await setup.initSendLibrary(
            wallet,
            endpointProgram,
            oappConfigPda,
            oappRegistryPda,
            sendLibraryConfigPda,
            DST_EID
        )
        console.log('✅ Init Send Library')

        await setup.initDefaultSendLibrary(wallet, endpointProgram, DST_EID, messageLibPda, messageLibInfoPda)
        console.log('✅ Init Default Send Library')

        await setup.initUln(wallet, ulnProgram, messageLibPda, helper.SOLANA_EID)
        console.log('✅ Initialized ULN')

        const noncePda = utils.getNoncePda(oappConfigPda, DST_EID, helper.PEER_ADDRESS)
        const pendingInboundNoncePda = utils.getPendingInboundNoncePda(oappConfigPda, DST_EID, helper.PEER_ADDRESS)

        await setup.initNonce(
            wallet,
            endpointProgram,
            oappConfigPda,
            oappRegistryPda,
            noncePda,
            pendingInboundNoncePda,
            DST_EID,
            PEER_ADDRESS
        )
        console.log('✅ Initialized Nonce')

        await provider.connection.requestAirdrop(attacker.publicKey, 1e9)
    })

    it('Set vault authority', async () => {
        const vaultAuthorityPda = utils.getVaultAuthorityPda(solanaVault.programId)

        // Only assertions. `initVault()` is already run in test setup
        let vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        assert.equal(vaultAuthority.dstEid, ORDERLY_EID)
        assert.equal(vaultAuthority.solChainId.eq(new BN(helper.SOLANA_CHAIN_ID)), true)
        console.log('✅ Checked Vault Authority state')

        // FAILURE CASE - when vaultAuthority owner is not the signer

        console.log('🥷 Attacker trying to set Vault Authority')
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
                admin: attacker.publicKey,
                vaultAuthority: vaultAuthorityPda,
                oappConfig: oappConfigPda,
            }
            await setup.setVault(attacker, solanaVault, setVaultParams, setVaultAccounts)
            console.log('❌ Attacker successfully set Vault Authority')
        } catch (e) {
            assert.equal(e.error.errorCode.code, 'Unauthorized')
            console.log('👌 Attacker failed to set Vault Authority')
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
        console.log('✅ Owner set Vault Authority')

        // Admin to reset vault authority (reset to original owner)
        setVaultParams.owner = wallet.publicKey
        setVaultParams.orderDelivery = true

        await setup.setVault(wallet.payer, solanaVault, setVaultParams, setVaultAccounts)

        vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.equal(vaultAuthority.owner.toString(), wallet.publicKey.toString())
        assert.equal(vaultAuthority.orderDelivery, true)
        console.log('✅ Reset Vault Authority')
    })

    it('Initialize oapp', async () => {
        const lzReceiveTypesPda = utils.getLzReceiveTypesPda(solanaVault.programId, oappConfigPda)
        const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
        const oappConfig = await solanaVault.account.oAppConfig.fetch(oappConfigPda)
        const lzReceiveTypes = await solanaVault.account.oAppLzReceiveTypesAccounts.fetch(lzReceiveTypesPda)
        const oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)

        assert.equal(lzReceiveTypes.oappConfig.toString(), oappConfigPda.toString())
        assert.equal(oappConfig.endpointProgram.toString(), endpointProgram.programId.toString())
        assert.equal(oappConfig.admin.toString(), wallet.publicKey.toString())
        assert.equal(oappRegistry.delegate.toString(), wallet.publicKey.toString())
        console.log('✅ Checked OAPP Config state')
    })

    it('Set account list', async () => {
        const USDC_INDEX = constants.TOKEN_INDEX.USDC
        const lzReceiveTypesPda = utils.getLzReceiveTypesPda(solanaVault.programId, oappConfigPda)
        const accountListPda = utils.getAccountListPda(solanaVault.programId, oappConfigPda)
        const withdrawUsdcPda = utils.getWithdrawTokenPda(solanaVault.programId, USDC_INDEX)
        const withdrawUsdtPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.USDT)
        const brokerPda = utils.getBrokerPdaWithBuf(
            solanaVault.programId,
            Array.from(Buffer.from(woofiBrokerHash.slice(2), 'hex'))
        )
        const withdrawWsolPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.WSOL)

        console.log('🥷 Attacker trying to set AccountList')
        let setAccountListParams, setAccountListAccounts

        try {
            setAccountListParams = {
                woofiProPda: brokerPda,
                withdrawUsdcPda: withdrawUsdcPda,
                usdcMint: USDC_MINT,
                withdrawUsdtPda: withdrawUsdtPda,
                usdtMint: USDT_MINT,
                withdrawWsolPda: withdrawWsolPda,
                wsolMint: NATIVE_MINT,
            }
            setAccountListAccounts = {
                admin: attacker.publicKey,
                oappConfig: oappConfigPda,
                lzReceiveTypes: lzReceiveTypesPda,
                accountsList: accountListPda,
                systemProgram: SystemProgram.programId,
            }
            await setup.setAccountList(attacker, solanaVault, setAccountListParams, setAccountListAccounts)
            console.log('❌ Attacker successfully set AccountList')
        } catch (e) {
            assert.equal(e.error.errorCode.code, 'Unauthorized')
            console.log('👌 Attacker failed to set AccountList')
            // console.log(e)
        }

        // Admin trying to set AccountList
        setAccountListAccounts.admin = wallet.publicKey
        await setup.setAccountList(wallet.payer, solanaVault, setAccountListParams, setAccountListAccounts)
        const accountListData = await solanaVault.account.accountList.fetch(accountListPda)
        assert.equal(accountListData.withdrawUsdcPda.toString(), withdrawUsdcPda.toString())
        assert.equal(accountListData.usdcMint.toString(), USDC_MINT.toString())
        assert.equal(accountListData.withdrawUsdtPda.toString(), withdrawUsdtPda.toString())
        assert.equal(accountListData.usdtMint.toString(), USDT_MINT.toString())
        assert.equal(accountListData.woofiProPda.toString(), brokerPda.toString())
        assert.equal(accountListData.withdrawWsolPda.toString(), withdrawWsolPda.toString())
        assert.equal(accountListData.wsolMint.toString(), NATIVE_MINT.toString())
        console.log('✅ Admin Set AccountList')
    })

    it('Set token manager role', async () => {
        const tokenManagerRoleHash = helper.getManagerRoleHash(constants.TOKEN_MANAGER_ROLE)

        const tokenManager = vaultOwner.publicKey
        const tokenManagerRolePda = utils.getManagerRolePdaWithBuf(
            solanaVault.programId,
            tokenManagerRoleHash,
            tokenManager
        )

        const setManagerRoleParams = {
            roleHash: tokenManagerRoleHash,
            managerAddress: tokenManager,
            allowed: true,
        }
        const setManagerRoleAccounts = {
            owner: vaultOwner.publicKey,
            vaultAuthority: vaultAuthorityPda,
            managerRole: tokenManagerRolePda,
            systemProgram: SystemProgram.programId,
        }

        await setup.setManagerRole(vaultOwner, solanaVault, setManagerRoleParams, setManagerRoleAccounts)
        const managerRole = await solanaVault.account.managerRole.fetch(tokenManagerRolePda)

        assert.equal(managerRole.allowed, true)
        assert.equal(managerRole.roleHash.toString(), tokenManagerRoleHash.toString())
        console.log('✅ Set Token Manager Role')
    })

    it('Set deposit token and withdraw token', async () => {
        const allowedUsdcTokenPda = utils.getTokenPdaWithBuf(solanaVault.programId, usdcTokenHash)
        const allowedUsdtTokenPda = utils.getTokenPdaWithBuf(solanaVault.programId, usdtTokenHash)
        const tokenManagerRoleHash = helper.getManagerRoleHash(constants.TOKEN_MANAGER_ROLE)
        const tokenManagerRolePda = utils.getManagerRolePdaWithBuf(
            solanaVault.programId,
            tokenManagerRoleHash,
            vaultOwner.publicKey
        )

        const setManagerRoleParams = {
            roleHash: tokenManagerRoleHash,
            managerAddress: attacker.publicKey,
            allowed: false,
        }
        const attackerTokenManagerRolePda = utils.getManagerRolePdaWithBuf(
            solanaVault.programId,
            tokenManagerRoleHash,
            attacker.publicKey
        )

        const setManagerRoleAccounts = {
            owner: vaultOwner.publicKey,
            vaultAuthority: vaultAuthorityPda,
            managerRole: attackerTokenManagerRolePda,
            systemProgram: SystemProgram.programId,
        }

        await setup.setManagerRole(vaultOwner, solanaVault, setManagerRoleParams, setManagerRoleAccounts)

        const attackerBrokerManagerRole = await solanaVault.account.managerRole.fetch(attackerTokenManagerRolePda)
        assert.equal(attackerBrokerManagerRole.allowed, false)
        assert.equal(attackerBrokerManagerRole.roleHash.toString(), tokenManagerRoleHash.toString())
        console.log('✅ Set Attacker Token Manager Role as False')

        console.log('🥷 Attacker trying to set Token')
        let setTokenParams, setTokenAccounts
        try {
            setTokenParams = {
                // tokenManagerRole: tokenManagerRoleHash,
                mintAccount: USDC_MINT,
                tokenHash: usdcTokenHash,
                allowed: true,
            }
            setTokenAccounts = {
                tokenManager: attacker.publicKey,
                mintAccount: USDC_MINT,
                allowedToken: allowedUsdcTokenPda,
                managerRole: attackerTokenManagerRolePda,
                systemProgram: SystemProgram.programId,
            }
            await setup.setToken(attacker, solanaVault, setTokenParams, setTokenAccounts)
            console.log('❌ Attacker successfully set Token')
        } catch (e) {
            assert.equal(e.error.errorCode.code, 'ManagerRoleNotAllowed')
            console.log('👌 Attacker failed to set Token')
        }

        console.log('🚀 Set USDC token for deposit')

        setTokenAccounts.tokenManager = wallet.publicKey
        setTokenAccounts.managerRole = tokenManagerRolePda
        await setup.setToken(wallet.payer, solanaVault, setTokenParams, setTokenAccounts)
        const allowedToken = await solanaVault.account.allowedToken.fetch(allowedUsdcTokenPda)
        assert.equal(allowedToken.mintAccount.toString(), USDC_MINT.toString())
        assert.deepEqual(allowedToken.tokenHash, usdcTokenHash)
        assert.equal(allowedToken.tokenDecimals, constants.TOKEN_DECIMALS.USDC)
        assert.equal(allowedToken.allowed, true)
        assert.isOk(allowedToken.bump)
        console.log('✅ Set USDC token for deposit')

        console.log('🚀 Set USDT token for deposit')

        setTokenParams.tokenHash = usdtTokenHash
        setTokenParams.allowed = true
        setTokenAccounts.allowedToken = allowedUsdtTokenPda
        setTokenAccounts.mintAccount = USDT_MINT
        await setup.setToken(wallet.payer, solanaVault, setTokenParams, setTokenAccounts)

        const allowedUsdtToken = await solanaVault.account.allowedToken.fetch(allowedUsdtTokenPda)
        assert.equal(allowedUsdtToken.mintAccount.toString(), USDT_MINT.toString())
        assert.deepEqual(allowedUsdtToken.tokenHash, usdtTokenHash)
        assert.equal(allowedUsdtToken.tokenDecimals, constants.TOKEN_DECIMALS.USDT)
        assert.equal(allowedUsdtToken.allowed, true)
        assert.isOk(allowedUsdtToken.bump)
        console.log('✅ Set USDT token for deposit')

        // console.log('🚀 Set wSOL token for deposit')
        // const wsolTokenPda = utils.getTokenPdaWithBuf(solanaVault.programId, wsolTokenHash)

        // setTokenParams.mintAccount = NATIVE_MINT
        // setTokenParams.tokenHash = wsolTokenHash
        // setTokenParams.allowed = true

        // setTokenAccounts.allowedToken = wsolTokenPda
        // setTokenAccounts.mintAccount = NATIVE_MINT
        // setTokenAccounts.tokenManager = wallet.publicKey

        // await setup.setToken(wallet.payer, solanaVault, setTokenParams, setTokenAccounts)

        // const wsolTokenPdaData = await solanaVault.account.allowedToken.fetch(wsolTokenPda)
        // console.log('wsolTokenPdaData', wsolTokenPdaData)
        // assert.equal(wsolTokenPdaData.mintAccount.toBase58(), NATIVE_MINT.toBase58())
        // assert.equal(wsolTokenPdaData.tokenHash.toString(), wsolTokenHash.toString())
        // assert.equal(wsolTokenPdaData.tokenDecimals, constants.TOKEN_DECIMALS.WSOL)
        // assert.equal(wsolTokenPdaData.allowed, true)

        // console.log('✅ Set WSOL token for deposit')

        const solTokenPda = utils.getTokenPdaWithBuf(solanaVault.programId, solTokenHash)

        setTokenParams.mintAccount = NATIVE_MINT
        setTokenParams.tokenHash = solTokenHash
        setTokenParams.allowed = true

        setTokenAccounts.allowedToken = solTokenPda
        setTokenAccounts.mintAccount = NATIVE_MINT
        setTokenAccounts.tokenManager = wallet.publicKey

        await setup.setToken(wallet.payer, solanaVault, setTokenParams, setTokenAccounts)

        const solTokenPdaData = await solanaVault.account.allowedToken.fetch(solTokenPda)
        assert.equal(solTokenPdaData.mintAccount.toBase58(), NATIVE_MINT.toBase58())
        assert.equal(solTokenPdaData.tokenHash.toString(), solTokenHash.toString())
        assert.equal(solTokenPdaData.tokenDecimals, constants.TOKEN_DECIMALS.SOL)
        assert.equal(solTokenPdaData.allowed, true)

        console.log('✅ Set SOL token for deposit')

        const usdcIndex = constants.TOKEN_INDEX.USDC
        const withdrawUsdcPda = utils.getWithdrawTokenPda(solanaVault.programId, usdcIndex)

        console.log('🥷 Attacker trying to set Withdraw Token')
        let setWithdrawTokenParams, setWithdrawTokenAccounts
        try {
            setWithdrawTokenParams = {
                // tokenManagerRole: tokenManagerRoleHash,
                // mintAccount: USDC_MINT,
                tokenHash: usdcTokenHash,
                tokenIndex: usdcIndex,
                allowed: true,
            }

            setWithdrawTokenAccounts = {
                tokenManager: attacker.publicKey,
                withdrawToken: withdrawUsdcPda,
                managerRole: attackerTokenManagerRolePda,
                mintAccount: USDC_MINT,
                // systemProgram: SystemProgram.programId
            }
            await setup.setWithdrawToken(attacker, solanaVault, setWithdrawTokenParams, setWithdrawTokenAccounts)
            console.log('❌ Attacker successfully set Withdraw Token')
        } catch (e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, 'ManagerRoleNotAllowed')
            console.log('👌 Attacker failed to set Withdraw Token')
        }

        setWithdrawTokenAccounts.tokenManager = wallet.publicKey
        setWithdrawTokenAccounts.managerRole = tokenManagerRolePda
        await setup.setWithdrawToken(wallet.payer, solanaVault, setWithdrawTokenParams, setWithdrawTokenAccounts)

        const withdrawToken = await solanaVault.account.withdrawToken.fetch(withdrawUsdcPda)
        assert.equal(withdrawToken.mintAccount.toString(), USDC_MINT.toString())
        assert.deepEqual(withdrawToken.tokenHash, usdcTokenHash)
        assert.equal(withdrawToken.tokenIndex, usdcIndex)
        assert.equal(withdrawToken.tokenDecimals, constants.TOKEN_DECIMALS.USDC)
        assert.equal(withdrawToken.allowed, true)
        assert.isOk(withdrawToken.bump)
        console.log('✅ Set USDC token for withdraw')

        console.log('🚀 Set USDT token for withdraw')
        const withdrawUsdtPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.USDT)

        setWithdrawTokenParams.tokenHash = usdtTokenHash
        setWithdrawTokenParams.tokenIndex = constants.TOKEN_INDEX.USDT
        setWithdrawTokenAccounts.withdrawToken = withdrawUsdtPda
        setWithdrawTokenAccounts.mintAccount = USDT_MINT
        await setup.setWithdrawToken(wallet.payer, solanaVault, setWithdrawTokenParams, setWithdrawTokenAccounts)

        const withdrawUsdtToken = await solanaVault.account.withdrawToken.fetch(withdrawUsdtPda)
        assert.equal(withdrawUsdtToken.mintAccount.toString(), USDT_MINT.toString())
        assert.deepEqual(withdrawUsdtToken.tokenHash, usdtTokenHash)
        assert.equal(withdrawUsdtToken.tokenIndex, constants.TOKEN_INDEX.USDT)
        assert.equal(withdrawUsdtToken.tokenDecimals, constants.TOKEN_DECIMALS.USDT)
        assert.equal(withdrawUsdtToken.allowed, true)
        assert.isOk(withdrawUsdtToken.bump)
        console.log('✅ Set USDT token for withdraw')

        // console.log('🚀 Set WSOL token for withdraw')
        // const withdrawWsolPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.WSOL)

        // setWithdrawTokenParams.tokenHash = wsolTokenHash
        // setWithdrawTokenParams.tokenIndex = constants.TOKEN_INDEX.WSOL
        // setWithdrawTokenAccounts.withdrawToken = withdrawWsolPda
        // setWithdrawTokenAccounts.mintAccount = NATIVE_MINT
        // await setup.setWithdrawToken(wallet.payer, solanaVault, setWithdrawTokenParams, setWithdrawTokenAccounts)

        // const withdrawWsolToken = await solanaVault.account.withdrawToken.fetch(withdrawWsolPda)
        // assert.equal(withdrawWsolToken.mintAccount.toString(), NATIVE_MINT.toString())
        // assert.deepEqual(withdrawWsolToken.tokenHash, wsolTokenHash)
        // assert.equal(withdrawWsolToken.tokenIndex, constants.TOKEN_INDEX.WSOL)
        // assert.equal(withdrawWsolToken.tokenDecimals, constants.TOKEN_DECIMALS.WSOL)
        // assert.equal(withdrawWsolToken.allowed, true)
        // assert.isOk(withdrawWsolToken.bump)
        // console.log('✅ Set WSOL token for withdraw')

        console.log('🚀 Set SOL token for withdraw')
        const withdrawSolPda = utils.getWithdrawTokenPda(solanaVault.programId, constants.TOKEN_INDEX.SOL)

        setWithdrawTokenParams.tokenHash = solTokenHash
        setWithdrawTokenParams.tokenIndex = constants.TOKEN_INDEX.SOL
        setWithdrawTokenAccounts.withdrawToken = withdrawSolPda
        setWithdrawTokenAccounts.mintAccount = NATIVE_MINT
        await setup.setWithdrawToken(wallet.payer, solanaVault, setWithdrawTokenParams, setWithdrawTokenAccounts)

        const withdrawSolToken = await solanaVault.account.withdrawToken.fetch(withdrawSolPda)
        assert.equal(withdrawSolToken.mintAccount.toString(), NATIVE_MINT.toString())
        assert.deepEqual(withdrawSolToken.tokenHash, solTokenHash)
        assert.equal(withdrawSolToken.tokenIndex, constants.TOKEN_INDEX.SOL)
        assert.equal(withdrawSolToken.tokenDecimals, constants.TOKEN_DECIMALS.SOL)
        assert.equal(withdrawSolToken.allowed, true)
        assert.isOk(withdrawSolToken.bump)
        console.log('✅ Set SOL token for withdraw')
    })

    it('Set broker manager role', async () => {
        const brokerManagerRoleHash = helper.getManagerRoleHash(constants.BROKER_MANAGER_ROLE)

        const brokerManager = vaultOwner.publicKey
        const brokerManagerRolePda = utils.getManagerRolePdaWithBuf(
            solanaVault.programId,
            brokerManagerRoleHash,
            brokerManager
        )

        const setManagerRoleParams = {
            roleHash: brokerManagerRoleHash,
            managerAddress: brokerManager,
            allowed: true,
        }
        const setManagerRoleAccounts = {
            owner: vaultOwner.publicKey,
            vaultAuthority: vaultAuthorityPda,
            managerRole: brokerManagerRolePda,
            systemProgram: SystemProgram.programId,
        }

        await setup.setManagerRole(vaultOwner, solanaVault, setManagerRoleParams, setManagerRoleAccounts)
        const managerRole = await solanaVault.account.managerRole.fetch(brokerManagerRolePda)

        assert.equal(managerRole.allowed, true)
        assert.equal(managerRole.roleHash.toString(), brokerManagerRoleHash.toString())
        console.log('✅ Set Broker Manager Role')
    })

    it('Set broker', async () => {
        const brokerSymbol = 'woofi_pro'
        const brokerHash = helper.getBrokerHash(brokerSymbol)
        const allowedBrokerPda = utils.getBrokerPdaWithBuf(solanaVault.programId, brokerHash)
        const brokerManagerRoleHash = helper.getManagerRoleHash(constants.BROKER_MANAGER_ROLE)
        const brokerManagerRolePda = utils.getManagerRolePdaWithBuf(
            solanaVault.programId,
            brokerManagerRoleHash,
            vaultOwner.publicKey
        )

        const setManagerRoleParams = {
            roleHash: brokerManagerRoleHash,
            managerAddress: attacker.publicKey,
            allowed: false,
        }
        const attackerBrokerManagerRolePda = utils.getManagerRolePdaWithBuf(
            solanaVault.programId,
            brokerManagerRoleHash,
            attacker.publicKey
        )

        const setManagerRoleAccounts = {
            owner: vaultOwner.publicKey,
            vaultAuthority: vaultAuthorityPda,
            managerRole: attackerBrokerManagerRolePda,
            systemProgram: SystemProgram.programId,
        }

        await setup.setManagerRole(vaultOwner, solanaVault, setManagerRoleParams, setManagerRoleAccounts)

        const attackerBrokerManagerRole = await solanaVault.account.managerRole.fetch(attackerBrokerManagerRolePda)
        assert.equal(attackerBrokerManagerRole.allowed, false)
        assert.equal(attackerBrokerManagerRole.roleHash.toString(), brokerManagerRoleHash.toString())
        console.log('✅ Set Attacker Broker Manager Role as False')
        console.log('🥷 Attacker trying to set Broker')
        let setBrokerParams, setBrokerAccounts

        try {
            setBrokerParams = {
                brokerManagerRole: brokerManagerRoleHash,
                brokerHash: brokerHash,
                allowed: true,
            }
            setBrokerAccounts = {
                brokerManager: attacker.publicKey,
                allowedBroker: allowedBrokerPda,
                managerRole: attackerBrokerManagerRolePda,
                systemProgram: SystemProgram.programId,
            }
            await setup.setBroker(attacker, solanaVault, setBrokerParams, setBrokerAccounts)
            console.log('❌ Attacker successfully set Broker')
        } catch (e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, 'ManagerRoleNotAllowed')
            console.log('👌 Attacker failed to set Broker')
        }
        setBrokerAccounts.brokerManager = vaultOwner.publicKey
        setBrokerAccounts.managerRole = brokerManagerRolePda
        await setup.setBroker(vaultOwner, solanaVault, setBrokerParams, setBrokerAccounts)
        const allowedBroker = await solanaVault.account.allowedBroker.fetch(allowedBrokerPda)
        assert.equal(allowedBroker.allowed, true)
        assert.deepEqual(allowedBroker.brokerHash, brokerHash)
        assert.isOk(allowedBroker.bump)
        console.log('✅ Set Broker')

        console.log('🚀 Set Withdraw Broker')
        const withdrawBrokerPda = utils.getWithdrawBrokerPda(
            solanaVault.programId,
            constants.WITHDRAW_BROKER_INDEX.woofi_pro
        )

        let setWithdrawBrokerParams, setWithdrawBrokerAccounts

        setWithdrawBrokerParams = {
            brokerManagerRole: brokerManagerRoleHash,
            brokerHash: brokerHash,
            brokerIndex: constants.WITHDRAW_BROKER_INDEX.woofi_pro,
            allowed: true,
        }
        setWithdrawBrokerAccounts = {
            brokerManager: wallet.publicKey,
            withdrawBroker: withdrawBrokerPda,
            managerRole: brokerManagerRolePda,
            systemProgram: SystemProgram.programId,
        }

        await setup.setWithdrawBroker(wallet.payer, solanaVault, setWithdrawBrokerParams, setWithdrawBrokerAccounts)
        const withdrawBroker = await solanaVault.account.withdrawBroker.fetch(withdrawBrokerPda)
        assert.equal(withdrawBroker.brokerHash.toString(), brokerHash.toString())
        assert.equal(withdrawBroker.brokerIndex, constants.WITHDRAW_BROKER_INDEX.woofi_pro)
        assert.equal(withdrawBroker.allowed, true)
        assert.isOk(withdrawBroker.bump)
        console.log('✅ Set Withdraw Broker')
    })

    it('Set order delivery', async () => {
        console.log('🥷 Attacker trying to set Order Delivery')
        let setOrderDeliveryParams, setOrderDeliveryAccounts
        try {
            setOrderDeliveryParams = {
                orderDelivery: true,
                nonce: new BN(0),
            }
            setOrderDeliveryAccounts = {
                owner: attacker.publicKey,
                vaultAuthority: vaultAuthorityPda,
            }
            await setup.setOrderDelivery(attacker, solanaVault, setOrderDeliveryParams, setOrderDeliveryAccounts)
            console.log('❌ Attacker successfully set Order Delivery')
        } catch (e) {
            assert.equal(e.error.errorCode.code, 'InvalidVaultOwner')
            console.log('👌 Attacker failed to set Order Delivery')
        }

        setOrderDeliveryAccounts.owner = wallet.publicKey
        await setup.setOrderDelivery(wallet.payer, solanaVault, setOrderDeliveryParams, setOrderDeliveryAccounts)

        vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
        assert.isTrue(vaultAuthority.orderDelivery)
        assert.isTrue(vaultAuthority.inboundNonce.eq(new BN('0')))
        console.log('✅ Set Order Delivery')
    })

    it('Set peer', async () => {
        const peerPda = utils.getPeerPda(solanaVault.programId, oappConfigPda, DST_EID)
        let peer = await solanaVault.account.peer.fetch(peerPda)
        assert.deepEqual(peer.address, PEER_ADDRESS)
        assert.isOk(peer.bump)

        // FAILURE CASE - when admin/owner is not the signer
        console.log('🥷 Attacker trying to set Peer')
        let setPeerParams, setPeerAccounts
        try {
            setPeerParams = {
                dstEid: DST_EID,
                peer: PEER_ADDRESS,
            }
            setPeerAccounts = {
                admin: attacker.publicKey,
                peer: peerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId,
            }
            await setup.setPeer(attacker, solanaVault, setPeerParams, setPeerAccounts)
            console.log('❌ Attacker successfully set Peer')
        } catch (e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, 'Unauthorized')
            console.log('👌 Attacker failed to set Peer')
        }

        setPeerAccounts.admin = wallet.publicKey
        await setup.setPeer(wallet.payer, solanaVault, setPeerParams, setPeerAccounts)
        peer = await solanaVault.account.peer.fetch(peerPda)
        assert.deepEqual(peer.address, PEER_ADDRESS)
        console.log('✅ Set Peer')
    })

    it('Sets rate limit', async () => {
        const peerPda = utils.getPeerPda(solanaVault.programId, oappConfigPda, DST_EID)

        console.log('🥷 Attacker trying to set Rate Limit')
        let setRateLimitParams, setRateLimitAccounts
        try {
            setRateLimitParams = {
                dstEid: DST_EID,
                refillPerSecond: new BN('13'),
                capacity: new BN('1000'),
                enabled: true,
            }
            setRateLimitAccounts = {
                admin: attacker.publicKey,
                oappConfig: oappConfigPda,
                peer: peerPda,
            }
            await setup.setRateLimit(attacker, solanaVault, setRateLimitParams, setRateLimitAccounts)
            console.log('❌ Attacker successfully set Rate Limit')
        } catch (e) {
            assert.equal(e.error.errorCode.code, 'Unauthorized')
            console.log('👌 Attacker failed to set Rate Limit')
        }

        setRateLimitAccounts.admin = wallet.publicKey
        await setup.setRateLimit(wallet.payer, solanaVault, setRateLimitParams, setRateLimitAccounts)

        const peer = await solanaVault.account.peer.fetch(peerPda)
        assert.isTrue(peer.rateLimiter.capacity.eq(new BN('1000')))
        assert.isTrue(peer.rateLimiter.refillPerSecond.eq(new BN('13')))
        console.log('✅ Set Rate Limit')
    })

    it('Set enforced options', async () => {
        const efOptionsPda = utils.getEnforcedOptionsPda(solanaVault.programId, oappConfigPda, DST_EID)

        console.log('🥷 Attacker trying to set Enforced Options')
        let setEnforcedOptionsParams, setEnforcedOptionsAccounts
        try {
            setEnforcedOptionsParams = {
                dstEid: DST_EID,
                send: Buffer.from([0, 3, 3]),
                sendAndCall: Buffer.from([0, 3, 3]),
            }
            setEnforcedOptionsAccounts = {
                admin: attacker.publicKey,
                oappConfig: oappConfigPda,
                enforcedOptions: efOptionsPda,
                systemProgram: SystemProgram.programId,
            }
            await setup.setEnforcedOptions(attacker, solanaVault, setEnforcedOptionsParams, setEnforcedOptionsAccounts)
            console.log('❌ Attacker successfully set Enforced Options')
        } catch (e) {
            assert.equal(e.error.errorCode.code, 'Unauthorized')
            console.log('👌 Attacker failed to set Enforced Options')
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
        const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)

        console.log('🥷 Attacker trying to set Delegate')
        let setDelegateParams, setDelegateAccounts
        setDelegateParams = {
            delegate: newDelegate.publicKey,
        }
        setDelegateAccounts = {
            admin: attacker.publicKey,
            oappConfig: oappConfigPda,
        }
        try {
            await setup.setDelegate(attacker, solanaVault, endpointProgram, setDelegateParams, setDelegateAccounts)
            console.log('❌ Attacker successfully set Delegate')
        } catch (e) {
            assert.equal(e.error.errorCode.code, 'Unauthorized')
            console.log('👌 Attacker failed to set Delegate')
        }

        setDelegateAccounts.admin = wallet.publicKey
        await setup.setDelegate(wallet.payer, solanaVault, endpointProgram, setDelegateParams, setDelegateAccounts)

        let oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        assert.equal(oappRegistry.delegate.toString(), newDelegate.publicKey.toString(), 'Delegate should be changed')

        let delegateOnchain = await OftTools.getDelegate(provider.connection, oappConfigPda, endpointProgram.programId)
        assert.equal(delegateOnchain.toString(), newDelegate.publicKey.toString())

        // Admin trying to reset Delegate
        setDelegateAccounts.admin = wallet.publicKey
        setDelegateParams.delegate = wallet.publicKey

        await setup.setDelegate(wallet.payer, solanaVault, endpointProgram, setDelegateParams, setDelegateAccounts)

        oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
        assert.equal(oappRegistry.delegate.toString(), wallet.publicKey.toString(), 'Delegate should be reset')

        delegateOnchain = await OftTools.getDelegate(provider.connection, oappConfigPda, endpointProgram.programId)
        assert.equal(delegateOnchain.toString(), wallet.publicKey.toString())

        console.log('✅ Set Delegate')
    })

    it('Transfer admin', async () => {
        const newAdmin = Keypair.generate()
        const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
        console.log('🥷 Attacker trying to transfer Admin')
        let transferAdminParams, transferAdminAccounts
        try {
            transferAdminParams = {
                admin: newAdmin.publicKey,
            }
            transferAdminAccounts = {
                admin: attacker.publicKey,
                oappConfig: oappConfigPda,
            }
            await setup.transferAdmin(attacker, solanaVault, transferAdminParams, transferAdminAccounts)
            console.log('❌ Attacker successfully transferred Admin')
        } catch (e) {
            // console.log(e)
            assert.equal(e.error.errorCode.code, 'Unauthorized')
            console.log('👌 Attacker failed to transfer Admin')
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

        console.log('✅ Transfer Admin')
    })
})
