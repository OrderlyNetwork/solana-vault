import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction , ConfirmOptions} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OftTools, EndpointProgram, extractEventFromTransactionSignature, lzReceive, getLzReceiveAccounts, LzReceiveParams } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options, Packet } from "@layerzerolabs/lz-v2-utilities";
import { encode } from 'bs58'
import * as utils from "./utils";
import * as constants from "./constants";
import { max } from "bn.js";

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const USDC_MINT = utils.getUSDCAddress(ENV)
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 


async function callLzReceive() {
    console.log(OAPP_PROGRAM_ID.toString());
    // const lzReceiveAlertSig = "5zMstQM8UgLtBwD46EEChepXBz27fuHs8ded5tVwNqa6nsEMePZasJuTeQH6wkzmgG8vMoFs4qcoHBMLJSmBmhak";
    // 456: 
  
    // 
    // 
    // 
    // 
    // 
    const lzReceiveAlertSigs = [
      "63RqgBa5taSzjrTDuDgDGJF4aeDkQPoS2dCbMHbVrwgtU9rtFYvXRmsiGZ1e3C1CaFi2JVXzafBucryiKnFtncbu"
    ]
    
    for (const alertSig of lzReceiveAlertSigs) {
      const [lzReceiveEventAlert] =  await extractEventFromTransactionSignature(provider.connection, EndpointProgram.PROGRAM_ID, alertSig, EndpointProgram.events.lzReceiveAlertEventBeet, {
        commitment: 'confirmed',
      })

      // utils.delay(ENV);
  
      const receivePacket = {
        version: 1,
        nonce: lzReceiveEventAlert.nonce.toString(),
        srcEid: lzReceiveEventAlert.srcEid,
        dstEid: ENV === 'MAIN' ? 30168 : 40168,
        sender: '0x' + Buffer.from(lzReceiveEventAlert.sender).toString('hex'),
        receiver: lzReceiveEventAlert.receiver.toBase58(), 
        guid: '0x'+ Buffer.from(lzReceiveEventAlert.guid).toString('hex'),
        message: '0x' + Buffer.from(lzReceiveEventAlert.message).toString('hex'),
        payload: '',
      }
      
      console.log(receivePacket);

      const receiverAccount = encode(Array.from(Buffer.from(receivePacket.message.slice(132, 132+64), 'hex')))
      // console.log(`receiver account ${receiverAccount}`)
      // const receiverATA = await getAssociatedTokenAddressSync(
      //  USDC_MINT,
      //   new PublicKey(receiverAccount)
      // )

      // console.log(`receiver ata: `, receiverATA.toBase58())

      // const receiverAccount = encode(Array.from(Buffer.from(receivePacket.message.slice(132, 132+64), 'hex')))
      // console.log(`receiver account ${receiverAccount}`)
      
      const receiverATA = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        USDC_MINT,
        new PublicKey(receiverAccount)
      )

      console.log(`receiver ata: `, receiverATA.address)

      const ixLzReceive = await lzReceive(provider.connection, wallet.payer.publicKey,receivePacket, undefined, "processed");
      // utils.delay(ENV);
      
      const txLzReceive = new Transaction().add(ixLzReceive);
        const option: ConfirmOptions = {
          skipPreflight: true,
          commitment: 'processed',
          preflightCommitment: 'processed',
          maxRetries: 100,
        }
      
      let retry = true;
      let counter = 0;
      const sigLzReceive = await provider.sendAndConfirm(txLzReceive, [wallet.payer], option);
      console.log("LzReceive transaction confirmed:", sigLzReceive);
      // while (retry) {
        
      //   try {
      //     const sigLzReceive = await provider.sendAndConfirm(txLzReceive, [wallet.payer], option);
      //     console.log("LzReceive transaction confirmed:", sigLzReceive);
      //     retry = false;
      //   } catch(e) {
      //     console.error("Error calling lzReceive", e);
      //     console.log(`Retry ${++counter}`);
      //   }
     
      // }
      // sleep 2 seconds
      // utils.delay(ENV);
    }
}

callLzReceive();

