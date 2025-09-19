import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { OftTools } from '@layerzerolabs/lz-solana-sdk-v2'
import { Options } from '@layerzerolabs/lz-v2-utilities'
import * as utils from './utils'
import * as constants from './constants'
const [provider, wallet, rpc] = utils.setAnchor()
const ENV = utils.getEnv()
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider)

async function setAccountList() {
    const multisig = utils.getMultisig(ENV)
    const useMultisig = true
    const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID)
    const lzReceiveTypesAccountsPda = utils.getLzReceiveTypesPda(OAPP_PROGRAM_ID, oappConfigPda)
    const accountListPda = utils.getAccountListPda(OAPP_PROGRAM_ID, oappConfigPda)
    const usdcSymbol = 'USDC'
    const usdtSymbol = 'USDT'
    const wsolSymbol = 'WSOL'
    const usdcIndex = constants.TOKEN_INDEX[usdcSymbol]
    const usdtIndex = constants.TOKEN_INDEX[usdtSymbol]
    const wsolIndex = constants.TOKEN_INDEX[wsolSymbol]
    const usdcMintAccount = utils.getTokenAddress(ENV, usdcSymbol)
    const usdtMintAccount = utils.getTokenAddress(ENV, usdtSymbol)
    const wsolMintAccount = utils.getTokenAddress(ENV, wsolSymbol)
    const usdcTokenHash = utils.getTokenHash(usdcSymbol)
    const usdtTokenHash = utils.getTokenHash(usdtSymbol)
    const wsolTokenHash = utils.getTokenHash(wsolSymbol)
    const usdcWithdrawTokenPda = utils.getWithdrawTokenPda(OAPP_PROGRAM_ID, usdcIndex)
    const usdtWithdrawTokenPda = utils.getWithdrawTokenPda(OAPP_PROGRAM_ID, usdtIndex)
    const wsolWithdrawTokenPda = utils.getWithdrawTokenPda(OAPP_PROGRAM_ID, wsolIndex)
    const brokerId = 'woofi_pro'
    const brokerHash = utils.getBrokerHash(brokerId)
    const brokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash)
    console.log('brokerPda', brokerPda)
    const params = {
        woofiProPda: brokerPda,
        withdrawUsdcPda: usdcWithdrawTokenPda,
        usdcMint: usdcMintAccount,
        withdrawUsdtPda: usdtWithdrawTokenPda,
        usdtMint: usdtMintAccount,
        withdrawWsolPda: wsolWithdrawTokenPda,
        wsolMint: wsolMintAccount,
    }
    console.log('params', params)
    const setAccountListParams = {
        admin: useMultisig ? multisig : wallet.publicKey,
        oappConfig: oappConfigPda,
        lzReceiveTypes: lzReceiveTypesAccountsPda,
        accountsList: accountListPda,
    }

    console.log('setAccountListParams', setAccountListParams)
    const ixSetAccountList = await OAppProgram.methods
        .setAccountList(params)
        .accounts(setAccountListParams)
        .instruction()

    console.log('ixSetAccountList', ixSetAccountList)

    console.log('brokerPda', brokerPda)

    const txSetAccountList = new Transaction().add(ixSetAccountList)

    if (useMultisig) {
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetAccountList)
        console.log('txBase58 for set account list:\n', txBase58)
    } else {
        console.log('Setting up Account List...')
        const sigSetAccountList = await sendAndConfirmTransaction(
            provider.connection,
            txSetAccountList,
            [wallet.payer],
            {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed',
            }
        )
        console.log('sigSetAccountList ', sigSetAccountList)
    }
}
setAccountList()
