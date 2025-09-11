import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from '../tests/types/endpoint'
import * as utils from '../scripts/utils'
import { EVENT_SEED, MESSAGE_LIB_SEED, OAPP_SEED } from '@layerzerolabs/lz-solana-sdk-v2'
import { ConfirmOptions, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { createSyncNativeInstruction, getOrCreateAssociatedTokenAccount, Account } from '@solana/spl-token'

import { DST_EID } from '../scripts/constants'
import * as helper from './helper'
import { Keypair } from '@solana/web3.js'
import { getEventAuthorityPda, getOAppConfigPda, getOAppRegistryPda } from '../scripts/utils'

export const confirmOptions: ConfirmOptions = {
    maxRetries: 6,
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
}

// functions to set up solana vault
export async function initOapp(
    wallet: anchor.Wallet,
    solanaVault: Program<SolanaVault>,
    endpointProgram: Program<Endpoint>
) {
    const [oappConfigPda, oappBump] = PublicKey.findProgramAddressSync([Buffer.from('OApp')], solanaVault.programId)
    const [lzReceiveTypesPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('LzReceiveTypes'), oappConfigPda.toBuffer()],
        solanaVault.programId
    )
    const [oappRegistryPda, oappRegistryBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('OApp'), oappConfigPda.toBuffer()],
        endpointProgram.programId
    )
    const [eventAuthorityPda] = PublicKey.findProgramAddressSync([Buffer.from(EVENT_SEED)], endpointProgram.programId)

    const accountListPda = utils.getAccountListPda(solanaVault.programId, oappConfigPda)

    let oappRegistry
    try {
        oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
    } catch {
        await solanaVault.methods
            .initOapp({
                admin: wallet.publicKey,
                endpointProgram: endpointProgram.programId,
                accountList: accountListPda,
            })
            .accounts({
                payer: wallet.publicKey,
                oappConfig: oappConfigPda,
                lzReceiveTypes: lzReceiveTypesPda,
                accountList: accountListPda,
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
        oappRegistry = await endpointProgram.account.oAppRegistry.fetch(oappRegistryPda)
    }

    return { oappRegistry, oappConfigPda }
}

export async function initVault(
    wallet: anchor.Wallet,
    solanaVault: Program<SolanaVault>,
    dstEid: number,
    solChainId: number
) {
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync([Buffer.from('VaultAuthority')], solanaVault.programId)
    const oappConfigPda = PublicKey.findProgramAddressSync([Buffer.from(OAPP_SEED, 'utf8')], solanaVault.programId)[0]

    let vaultAuthority
    try {
        vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
    } catch {
        await solanaVault.methods
            .setVault({
                owner: wallet.publicKey,
                depositNonce: new BN(0),
                orderDelivery: true,
                inboundNonce: new BN(0),
                dstEid: dstEid,
                solChainId: new BN(solChainId),
            })
            .accounts({
                admin: wallet.publicKey,
                vaultAuthority: vaultAuthorityPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([wallet.payer])
            .rpc(confirmOptions)
        vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
    }

    vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
    return { vaultAuthority, vaultAuthorityPda }
}

export async function setVault(
    vaultAdmin: Keypair,
    solanaVault: Program<SolanaVault>,
    setVaultParams: any,
    setVaultAccounts: any
) {
    await solanaVault.methods
        .setVault(setVaultParams)
        .accounts(setVaultAccounts)
        .signers([vaultAdmin])
        .rpc(confirmOptions)
    const vaultAuthorityPda = setVaultAccounts.vaultAuthority
    const vaultAuthority = await solanaVault.account.vaultAuthority.fetch(setVaultAccounts.vaultAuthority)
    return { vaultAuthority, vaultAuthorityPda }
}

export async function initPeer(
    admin: anchor.Wallet,
    solanaVault: Program<SolanaVault>,
    oappConfigPda: PublicKey,
    dstEid: number,
    peerAddress: any
) {
    const peerPda = utils.getPeerPda(solanaVault.programId, oappConfigPda, dstEid)
    // const PEER_ADDRESS = peerAddress  // placeholder for peer address
    let peer
    try {
        peer = await solanaVault.account.peer.fetch(peerPda)
    } catch {
        await solanaVault.methods
            .setPeer({
                dstEid: dstEid,
                peer: peerAddress,
            })
            .accounts({
                admin: admin.publicKey,
                peer: peerPda,
                oappConfig: oappConfigPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc(confirmOptions)
    }

    return { peer, peerPda }
}

export async function initEnforcedOptions(
    wallet: anchor.Wallet,
    solanaVault: Program<SolanaVault>,
    oappConfigPda: PublicKey,
    dstEid: number
) {
    const efOptionsPda = utils.getEnforcedOptionsPda(solanaVault.programId, oappConfigPda, dstEid)

    let efOptions
    try {
        efOptions = await solanaVault.account.enforcedOptions.fetch(efOptionsPda)
    } catch {
        await solanaVault.methods
            .setEnforcedOptions({
                dstEid: dstEid,
                send: Buffer.from([0, 3, 3]),
                sendAndCall: Buffer.from([0, 3, 3]),
            })
            .accounts({
                admin: wallet.publicKey,
                oappConfig: oappConfigPda,
                enforcedOptions: efOptionsPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc(confirmOptions)
        efOptions = await solanaVault.account.enforcedOptions.fetch(efOptionsPda)
    }

    return { efOptions, efOptionsPda }
}

export async function setAccountList(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setAccountListParams: any,
    setAccountListAccounts: any
) {
    await solanaVault.methods
        .setAccountList(setAccountListParams)
        .accounts(setAccountListAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}

export async function setManagerRole(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setManagerRoleParams: any,
    setManagerRoleAccounts: any
) {
    await solanaVault.methods
        .setManagerRole(setManagerRoleParams)
        .accounts(setManagerRoleAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}

export async function setBroker(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setBrokerParams: any,
    setBrokerAccounts: any
) {
    await solanaVault.methods
        .setBroker(setBrokerParams)
        .accounts(setBrokerAccounts)
        .signers([signer])
        .rpc(confirmOptions)

    const allowedBrokerPda = setBrokerAccounts.allowedBroker
    const allowedBroker = await solanaVault.account.allowedBroker.fetch(allowedBrokerPda)
    return { allowedBroker, allowedBrokerPda }
}

export async function setWithdrawBroker(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setWithdrawBrokerParams: any,
    setWithdrawBrokerAccounts: any
) {
    await solanaVault.methods
        .setWithdrawBroker(setWithdrawBrokerParams)
        .accounts(setWithdrawBrokerAccounts)
        .signers([signer])
        .rpc(confirmOptions)
    const withdrawBrokerPda = setWithdrawBrokerAccounts.withdrawBroker
    const withdrawBroker = await solanaVault.account.withdrawBroker.fetch(withdrawBrokerPda)
    return { withdrawBroker, withdrawBrokerPda }
}

export async function setToken(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setTokenParams: any,
    setTokenAccounts: any
) {
    await solanaVault.methods.setToken(setTokenParams).accounts(setTokenAccounts).signers([signer]).rpc(confirmOptions)
    const allowedTokenPda = setTokenAccounts.allowedToken
    const allowedToken = await solanaVault.account.allowedToken.fetch(allowedTokenPda)
    return { allowedToken, allowedTokenPda }
}

export async function setWithdrawToken(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setWithdrawTokenParams: any,
    setWithdrawTokenAccounts: any
) {
    await solanaVault.methods
        .setWithdrawToken(setWithdrawTokenParams)
        .accounts(setWithdrawTokenAccounts)
        .signers([signer])
        .rpc(confirmOptions)
    const withdrawTokenPda = setWithdrawTokenAccounts.withdrawToken
    const withdrawToken = await solanaVault.account.withdrawToken.fetch(withdrawTokenPda)
    return { withdrawToken, withdrawTokenPda }
}

export async function setOrderDelivery(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setOrderDeliveryParams: any,
    setOrderDeliveryAccounts: any
) {
    await solanaVault.methods
        .setOrderDelivery(setOrderDeliveryParams)
        .accounts(setOrderDeliveryAccounts)
        .signers([signer])
        .rpc(confirmOptions)
    const vaultAuthorityPda = setOrderDeliveryAccounts.vaultAuthority
    const vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
    return { vaultAuthority, vaultAuthorityPda }
}

export async function setPeer(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setPeerParams: any,
    setPeerAccounts: any
) {
    await solanaVault.methods.setPeer(setPeerParams).accounts(setPeerAccounts).signers([signer]).rpc(confirmOptions)
}

export async function setRateLimit(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setRateLimitParams: any,
    setRateLimitAccounts: any
) {
    await solanaVault.methods
        .setRateLimit(setRateLimitParams)
        .accounts(setRateLimitAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}

export async function setEnforcedOptions(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    setEnforcedOptionsParams: any,
    setEnforcedOptionsAccounts: any
) {
    await solanaVault.methods
        .setEnforcedOptions(setEnforcedOptionsParams)
        .accounts(setEnforcedOptionsAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}

export async function setDelegate(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    endpointProgram: Program<Endpoint>,
    setDelegateParams: any,
    setDelegateAccounts: any
) {
    const setDelegateRemainingAccounts = helper.getDelegateRemainingAccounts(solanaVault, endpointProgram)

    await solanaVault.methods
        .setDelegate(setDelegateParams)
        .accounts(setDelegateAccounts)
        .remainingAccounts(setDelegateRemainingAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}

export async function transferAdmin(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    transferAdminParams: any,
    transferAdminAccounts: any
) {
    await solanaVault.methods
        .transferAdmin(transferAdminParams)
        .accounts(transferAdminAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}
// functions to set up endpoint and uln
export async function initEndpoint(endpointAdmin: Keypair, endpointProgram: Program<Endpoint>) {
    const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
    let endpoint
    try {
        endpoint = await endpointProgram.account.endpointSettings.fetch(endpointPda)
    } catch {
        await endpointProgram.methods
            .initEndpoint({
                eid: 30168,
                admin: endpointAdmin.publicKey,
            })
            .accounts({
                endpoint: endpointPda,
                payer: endpointAdmin.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc(confirmOptions)
        endpoint = await endpointProgram.account.endpointSettings.fetch(endpointPda)
    }

    return { endpoint, endpointPda }
}

export async function registerLibrary(
    endpointAdmin: anchor.Wallet,
    ulnProgram: Program<Uln>,
    endpointProgram: Program<Endpoint>,
    messageLibPda: PublicKey,
    messageLibInfoPda: PublicKey
) {
    const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
    await endpointProgram.methods
        .registerLibrary({
            libProgram: ulnProgram.programId,
            libType: { sendAndReceive: {} },
        })
        .accounts({
            admin: endpointAdmin.publicKey,
            endpoint: endpointPda,
            messageLibInfo: messageLibInfoPda,
            systemProgram: SystemProgram.programId,
        })
        .rpc(confirmOptions)
}

export async function initSendLibrary(
    delegate: anchor.Wallet,
    endpointProgram: Program<Endpoint>,
    oappConfigPda: PublicKey,
    oappRegistryPda: PublicKey,
    sendLibraryConfigPda: PublicKey,
    dstEid: number
) {
    await endpointProgram.methods
        .initSendLibrary({
            sender: oappConfigPda,
            eid: dstEid,
        })
        .accounts({
            delegate: delegate.publicKey,
            oappRegistry: oappRegistryPda,
            sendLibraryConfig: sendLibraryConfigPda,
            systemProgram: SystemProgram.programId,
        })
        .rpc(confirmOptions)
}

export async function initDefaultSendLibrary(
    endpointAdmin: anchor.Wallet,
    endpointProgram: Program<Endpoint>,
    dstEid: number,
    messageLibPda: PublicKey,
    messageLibInfoPda: PublicKey
) {
    const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
    const defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(dstEid)
    await endpointProgram.methods
        .initDefaultSendLibrary({
            eid: dstEid,
            newLib: messageLibPda,
        })
        .accounts({
            admin: endpointAdmin.publicKey,
            endpoint: endpointPda,
            defaultSendLibraryConfig: defaultSendLibraryConfigPda,
            messageLibInfo: messageLibInfoPda,
            systemProgram: SystemProgram.programId,
        })
        // .signers([endpointAdmin.payer])
        .rpc(confirmOptions)
}

export async function initUln(
    wallet: anchor.Wallet,
    ulnProgram: Program<Uln>,
    messageLibPda: PublicKey,
    solanaEid: number
) {
    await ulnProgram.methods
        .initUln({
            eid: solanaEid,
            endpoint: helper.LAYERZERO_ENDPOINT_PROGRAM_ID,
            endpointProgram: helper.LAYERZERO_ENDPOINT_PROGRAM_ID,
            admin: wallet.publicKey,
        })
        .accounts({
            payer: wallet.publicKey,
            uln: messageLibPda,
            systemProgram: SystemProgram.programId,
        })
        .rpc(confirmOptions)
}

export async function initNonce(
    delegate: anchor.Wallet,
    endpointProgram: Program<Endpoint>,
    oappConfigPda: PublicKey,
    oappRegistryPda: PublicKey,
    noncePda: PublicKey,
    pendingInboundNoncePda: PublicKey,
    dstEid: number,
    peerAddress: any
) {
    await endpointProgram.methods
        .initNonce({
            localOapp: oappConfigPda,
            remoteEid: dstEid,
            remoteOapp: peerAddress,
        })
        .accounts({
            delegate: delegate.publicKey,
            oappRegistry: oappRegistryPda,
            nonce: noncePda,
            pendingInboundNonce: pendingInboundNoncePda,
            systemProgram: SystemProgram.programId,
        })
        .signers([delegate.payer])
        .rpc(confirmOptions)
}

export async function initReceiveLibrary(
    delegate: Keypair,
    endpointAdmin: Keypair,
    solanaVault: Program<SolanaVault>,
    endpointProgram: Program<Endpoint>,
    dstEid: number
) {
    const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
    const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
    const receiveLibraryConfigPda = utils.getReceiveLibConfigPda(oappConfigPda, dstEid)
    await endpointProgram.methods
        .initReceiveLibrary({
            receiver: oappConfigPda,
            eid: dstEid,
        })
        .accounts({
            delegate: delegate.publicKey,
            oappRegistry: oappRegistryPda,
            receiveLibraryConfig: receiveLibraryConfigPda,
            systemProgram: SystemProgram.programId,
        })
        .signers([endpointAdmin])
        .rpc(confirmOptions)
    console.log('✅ Initialized Receive Library')
}

export async function initDefaultReceiveLibrary(
    endpointAdmin: Keypair,
    endpointProgram: Program<Endpoint>,
    ulnProgram: Program<Uln>,
    dstEid: number
) {
    const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
    const messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
    const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
    const defaultReceiveLibraryConfigPda = utils.getDefaultReceiveLibConfigPda(dstEid)
    await endpointProgram.methods
        .initDefaultReceiveLibrary({
            eid: dstEid,
            newLib: messageLibPda,
        })
        .accounts({
            admin: endpointAdmin.publicKey,
            endpoint: endpointPda,
            defaultReceiveLibraryConfig: defaultReceiveLibraryConfigPda,
            messageLibInfo: messageLibInfoPda,
            systemProgram: SystemProgram.programId,
        })
        .signers([endpointAdmin])
        .rpc(confirmOptions)
}

export async function initVerify(
    wallet: anchor.Wallet,
    endpointAdmin: Keypair,
    solanaVault: Program<SolanaVault>,
    endpointProgram: Program<Endpoint>,
    msgSender: PublicKey,
    nonce: number,
    peerAddress: any,
    dstEid: number
) {
    const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
    const payloadHashPda = utils.getPayloadHashPda(oappConfigPda, dstEid, msgSender, BigInt(nonce))
    const noncePda = utils.getNoncePda(oappConfigPda, dstEid, peerAddress)
    await endpointProgram.methods
        .initVerify({
            srcEid: dstEid,
            sender: Array.from(msgSender.toBytes()),
            receiver: oappConfigPda,
            nonce: new BN(nonce),
        })
        .accounts({
            payer: wallet.publicKey,
            nonce: noncePda,
            payloadHash: payloadHashPda,
            systemProgram: SystemProgram.programId,
        })
        .signers([endpointAdmin])
        .rpc(confirmOptions)
    console.log(`✅ Initialized Verify for message ${nonce}`)
}

export async function commitVerify(
    wallet: anchor.Wallet,
    endpointAdmin: Keypair,
    solanaVault: Program<SolanaVault>,
    endpointProgram: Program<Endpoint>,
    ulnProgram: Program<Uln>,
    nonce: number,
    msg: any,
    msgSender: PublicKey,
    peerAddress: any,
    orderlyEid: number,
    solanaEid: number,
    guid: number[]
) {
    const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
    const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
    const commitRemainingAccounts = await helper.getCommitRemainingAccounts(
        solanaVault,
        endpointProgram,
        ulnProgram,
        orderlyEid,
        solanaEid,
        peerAddress,
        msgSender,
        nonce
    )
    await ulnProgram.methods
        .commitVerification({
            nonce: new BN(nonce),
            srcEid: orderlyEid,
            sender: msgSender,
            dstEid: solanaEid,
            receiver: Array.from(oappConfigPda.toBytes()),
            guid: guid,
            message: msg,
        })
        .accounts({
            uln: messageLibPda,
        })
        .remainingAccounts(commitRemainingAccounts)
        .rpc(confirmOptions)

    console.log(`✅ Commit verification for message ${nonce} `)
}

export async function lzReceive(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    endpointProgram: Program<Endpoint>,
    ulnProgram: Program<Uln>,
    nonce: number,
    receiveParams: any,
    receiveAccounts: any,
    msgSender: PublicKey,
    peerAddress: any,
    orderlyEid: number,
    solanaEid: number
) {
    const lzReceiveRemainingAccounts = await helper.getLzReceiveRemainingAccounts(
        solanaVault,
        endpointProgram,
        ulnProgram,
        orderlyEid,
        solanaEid,
        peerAddress,
        msgSender,
        nonce
    )
    const lzReceiveTx = await solanaVault.methods
        .lzReceive(receiveParams)
        .accounts(receiveAccounts)
        .remainingAccounts(lzReceiveRemainingAccounts)
        .signers([signer])
        .rpc(confirmOptions)

    return lzReceiveTx
}

export async function deposit(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    depositParams: any,
    feeParams: any,
    accounts: any,
    depsoitRemainingAccounts: any
) {
    await solanaVault.methods
        .deposit(depositParams, feeParams)
        .accounts(accounts)
        .remainingAccounts(depsoitRemainingAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}

export async function depositSol(
    signer: Keypair,
    solanaVault: Program<SolanaVault>,
    depositParams: any,
    feeParams: any,
    accounts: any,
    depsoitRemainingAccounts: any
) {
    await solanaVault.methods
        .depositSol(depositParams, feeParams)
        .accounts(accounts)
        .remainingAccounts(depsoitRemainingAccounts)
        .signers([signer])
        .rpc(confirmOptions)
}

export async function swapSolToWsol(
    wallet: anchor.Wallet,
    provider: anchor.AnchorProvider,
    wsolReceiverAccount: Account,
    solAmount: number
) {
    // transform SOL to WSOL
    let tx = new Transaction().add(
        // transfer SOL
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: wsolReceiverAccount.address,
            lamports: solAmount,
        }),
        // sync wrapped SOL balance
        createSyncNativeInstruction(wsolReceiverAccount.address)
    )

    await sendAndConfirmTransaction(provider.connection, tx, [wallet.payer])
}
