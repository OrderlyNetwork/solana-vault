import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction, ConfirmOptions, ComputeBudgetProgram } from '@solana/web3.js'
import { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync } from '@solana/spl-token'
import {
    OftTools,
    EndpointProgram,
    extractEventFromTransactionSignature,
    lzReceive,
    getLzReceiveAccounts,
    LzReceiveParams,
} from '@layerzerolabs/lz-solana-sdk-v2'
import { Options, Packet } from '@layerzerolabs/lz-v2-utilities'
import { encode } from 'bs58'
import * as utils from './utils'
import * as constants from './constants'
import { max } from 'bn.js'

const [provider, wallet, rpc] = utils.setAnchor()
const ENV = utils.getEnv()
const USDC_MINT = utils.getUSDCAddress(ENV)
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider)

async function callLzReceive() {
    console.log(OAPP_PROGRAM_ID.toString())

    const lzReceiveAlertSigs = [
        'ZAJJ4nc6AsQWubLu8YGvgX3w7vC3mBmuvEYCDG6uPsDrNk2xMzfbuH5dNxdoqP7XEuZjX5DKGwG7Ua9a3C153dL',
    ]

    for (const alertSig of lzReceiveAlertSigs) {
        const [lzReceiveEventAlert] = await extractEventFromTransactionSignature(
            provider.connection,
            EndpointProgram.PROGRAM_ID,
            alertSig,
            EndpointProgram.events.lzReceiveAlertEventBeet,
            {
                commitment: 'confirmed',
            }
        )

        // utils.delay(ENV);

        const receivePacket = {
            version: 1,
            nonce: lzReceiveEventAlert.nonce.toString(),
            srcEid: lzReceiveEventAlert.srcEid,
            dstEid: ENV === 'MAIN' ? 30168 : 40168,
            sender: '0x' + Buffer.from(lzReceiveEventAlert.sender).toString('hex'),
            receiver: lzReceiveEventAlert.receiver.toBase58(),
            guid: '0x' + Buffer.from(lzReceiveEventAlert.guid).toString('hex'),
            message: '0x' + Buffer.from(lzReceiveEventAlert.message).toString('hex'),
            payload: '',
        }

        console.log(receivePacket)

        const receiverAccount = encode(Array.from(Buffer.from(receivePacket.message.slice(100, 100 + 64), 'hex')))
        console.log(`receiver account ${receiverAccount}`) // console.log(`receiver ata: `, receiverATA.address)

        const ixLzReceive = await lzReceive(
            provider.connection,
            wallet.payer.publicKey,
            receivePacket,
            undefined,
            'processed'
        )
        const ixAddComputeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 })
        // utils.delay(ENV);
        const ixComputeBudget = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 10000000, // set priority fee
        })
        const txLzReceive = new Transaction().add(ixLzReceive, ixAddComputeBudget, ixComputeBudget)
        const option: ConfirmOptions = {
            skipPreflight: true,
            commitment: 'processed',
            preflightCommitment: 'processed',
            maxRetries: 100,
        }

        let retry = true
        let counter = 0
        const sigLzReceive = await provider.sendAndConfirm(txLzReceive, [wallet.payer], option)
        console.log('LzReceive transaction confirmed:', sigLzReceive)
    }
}

callLzReceive()
