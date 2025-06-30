import * as anchor from '@coral-xyz/anchor'
import { BN, Program, Idl } from '@coral-xyz/anchor'
import { SolanaVault } from '../target/types/solana_vault'
import { Uln } from '../target/types/uln'
import { Endpoint } from './types/endpoint'
import endpointIdl from './idl/endpoint.json'
import { MainnetV2EndpointId } from '@layerzerolabs/lz-definitions'
import { ConfirmOptions, Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
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
import { confirmOptions } from './setup'

import * as utils from '../scripts/utils'
import { getEnv } from '../scripts/utils'


// constants

export const USDC_SYMBOL = "USDC"
export const WOOFI_PRO_BROKER_ID = "woofi_pro"
export const LAYERZERO_ENDPOINT_PROGRAM_ID = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
export const ORDERLY_EID = MainnetV2EndpointId.ORDERLY_V2_MAINNET
export const SOLANA_EID = MainnetV2EndpointId.SOLANA_V2_MAINNET
export const SOLANA_CHAIN_ID = 901901901
export const ENV = utils.getEnv()
export const PEER_ADDRESS = utils.getPeerAddress(ENV)
export function getTokenHash(tokenSymbol: string) {
    return Array.from(Buffer.from(utils.getTokenHash(tokenSymbol).slice(2), 'hex'))
}
export function getBrokerHash(brokerId: string) {
    return Array.from(Buffer.from(utils.getBrokerHash(brokerId).slice(2), 'hex'))
}

// Get the balance of a token account
export async function getTokenBalance(
    connection: Connection,
    tokenAccount: PublicKey
): Promise<number> {
    const account = await getAccount(connection, tokenAccount)
    return Number(account.amount)
}

export function encodeMessage(msgType: number, payload: Buffer): Buffer {
    const encoded = Buffer.alloc(1 + payload.length)
    encoded.writeUIntBE(msgType, 0, 1)
    payload.copy(encoded, 1)
    return encoded
}


// Mint tokens to a wallet
export async function mintTokenTo(
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


export function prepareEnviroment() {
    const provider = anchor.AnchorProvider.env()
    const wallet = provider.wallet as anchor.Wallet
    anchor.setProvider(provider)
    const endpointProgram = new Program(endpointIdl as Idl, LAYERZERO_ENDPOINT_PROGRAM_ID, provider) as Program<Endpoint>
    const ulnProgram = anchor.workspace.Uln as Program<Uln>
    const solanaVault = anchor.workspace.SolanaVault as Program<SolanaVault>
    return { provider, wallet, endpointProgram, ulnProgram, solanaVault }
}


// functions to get accounts

export function getDelegateRemainingAccounts(solanaVault: Program<SolanaVault>, endpointProgram: Program<Endpoint>) {
    const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
    const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
    const eventAuthorityPda = utils.getEventAuthorityPda()

    const setDelegateRemainingAccounts = [
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
        }
    ]
    return setDelegateRemainingAccounts
}

export async function getDepositRemainingAccounts(solanaVault: Program<SolanaVault>, endpointProgram: Program<Endpoint>, ulnProgram: Program<Uln>) {
    const vaultAuthorityPda = utils.getVaultAuthorityPda(solanaVault.programId)
    const vaultAuthority = await solanaVault.account.vaultAuthority.fetch(vaultAuthorityPda)
    const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
    console.log("oappConfigPda", oappConfigPda)
    console.log("vaultAuthority.dstEid", vaultAuthority.dstEid)
    const sendLibraryConfigPda = utils.getSendLibConfigPda(oappConfigPda, vaultAuthority.dstEid)
    const defaultSendLibraryConfigPda = utils.getDefaultSendLibConfigPda(vaultAuthority.dstEid)
    const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
    const  messageLibInfoPda = utils.getMessageLibInfoPda(messageLibPda)
    const eventAuthorityPda = utils.getEventAuthorityPda()
    const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
    const noncePda = utils.getNoncePda(oappConfigPda, vaultAuthority.dstEid, PEER_ADDRESS)
    
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

    return depositRemainingAccounts
    
}

export async function getCommitRemainingAccounts(solanaVault: Program<SolanaVault>, endpointProgram: Program<Endpoint>, ulnProgram: Program<Uln>, srcEid: number, dstEid: number, peerAddress: any, msgSender: PublicKey, nonce: number) {
    const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
    const eventAuthorityPda = utils.getEventAuthorityPda()
    const messageLibPda = utils.getMessageLibPda(ulnProgram.programId)
    const receiveLibraryConfigPda = utils.getReceiveLibConfigPda(oappConfigPda, srcEid)
    const defaultReceiveLibraryConfigPda = utils.getDefaultReceiveLibConfigPda(srcEid)
    const noncePda = utils.getNoncePda(oappConfigPda, srcEid, peerAddress)
    const pendingInboundNoncePda = utils.getPendingInboundNoncePda(oappConfigPda, srcEid, peerAddress)
    const payloadHashPda = utils.getPayloadHashPda(oappConfigPda, srcEid, msgSender, BigInt(nonce))
    
    const remainingAccounts = [
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
    ]
    return remainingAccounts
}

export async function getLzReceiveRemainingAccounts(solanaVault: Program<SolanaVault>, endpointProgram: Program<Endpoint>, ulnProgram: Program<Uln>, orderlyEid: number, solanaEid: number, peerAddress: any, msgSender: PublicKey, nonce: number) {
    const oappConfigPda = utils.getOAppConfigPda(solanaVault.programId)
    const oappRegistryPda = utils.getOAppRegistryPda(oappConfigPda)
    const eventAuthorityPda = utils.getEventAuthorityPda()
    const endpointPda = utils.getEndpointSettingPda(endpointProgram.programId)
    const payloadHashPda = utils.getPayloadHashPda(oappConfigPda, orderlyEid, msgSender, BigInt(nonce))
    const noncePda = utils.getNoncePda(oappConfigPda, orderlyEid, peerAddress)

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
    return lzReceiveRemainingAccounts
}

