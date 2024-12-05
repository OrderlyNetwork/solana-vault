import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { OftTools, EndpointProgram, extractEventFromTransactionSignature, lzReceive, getLzReceiveAccounts, LzReceiveParams } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options, Packet } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 


async function callLzReceive() {
    console.log(OAPP_PROGRAM_ID.toString());
    // const lzReceiveAlertSig = "5zMstQM8UgLtBwD46EEChepXBz27fuHs8ded5tVwNqa6nsEMePZasJuTeQH6wkzmgG8vMoFs4qcoHBMLJSmBmhak";
    const lzReceiveAlertSigs = [
      "ikBqWGH3scTtBwwxmXWSkzuciKp92nnQwgPBwkVGZgGuednvDfpeA4fPHNxKfbS4D2ZRRmiFkJAJ4i2Nkt1ubqc", 
      "57UEtqCqNhMWxzKxHb5pY1aK4NB47EEKt1eLw995fax4nrD4NAHDYaVs2U13jP3BvPsxwPK1Sc74rw7oVf3yrp3F", 
      "4xLSMjF5UkBBsiMMkkQ1T7jmtWkN4r598jyDK8tAxwnmmnr6YpWBmJrCpBMmrYJ7oT18feCmXLL4V52UvDKdytqw",
      "5SRas21FNjKu3UP4WaG524oUcmczzygESzkKrD66VauoZ41GNP6oKsCjNsARzUYPL4LCqtZUyy5fdojhY9sJ8VF6",
      "RRWku2YHc9L5YagniNBvfRkM8BwPXsiszRaKs1XP2cCrNJkYX1otheHcLWn6yGgynSgH2N51iv6RdmNTBw5icYv"
    ]
    
    for (const alertSig of lzReceiveAlertSigs) {
      const [lzReceiveEventAlert] =  await extractEventFromTransactionSignature(provider.connection, EndpointProgram.PROGRAM_ID, alertSig, EndpointProgram.events.lzReceiveAlertEventBeet, {
        commitment: 'confirmed',
      })

      utils.delay(ENV);
      console.log(lzReceiveEventAlert)
  
      const receivePacket = {
        version: 1,
        nonce: lzReceiveEventAlert.nonce.toString(),
        srcEid: lzReceiveEventAlert.srcEid,
        dstEid: 40168,
        sender: '0x' + Buffer.from(lzReceiveEventAlert.sender).toString('hex'),
        receiver: lzReceiveEventAlert.receiver.toBase58(), 
        guid: '0x'+ Buffer.from(lzReceiveEventAlert.guid).toString('hex'),
        message: '0x' + Buffer.from(lzReceiveEventAlert.message).toString('hex'),
        payload: '',
      }
  
      console.log(receivePacket)
  
      const ixLzReceive = await lzReceive(provider.connection, wallet.payer.publicKey,receivePacket);
      utils.delay(ENV);
      const txLzReceive = new Transaction().add(ixLzReceive);
      const sigLzReceive = await provider.sendAndConfirm(txLzReceive, [wallet.payer]);

  
      console.log("LzReceive transaction confirmed:", sigLzReceive);
      // sleep 2 seconds
      utils.delay(ENV);
    }
}

callLzReceive();

