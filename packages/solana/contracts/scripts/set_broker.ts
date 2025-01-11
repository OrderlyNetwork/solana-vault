import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(ENV, provider); 

async function setBroker() {
    const multisig = utils.getMultisig(ENV);
    const useMultisig = true;
    const allowedBrokerList = utils.getBrokerList(ENV);
    console.log("Setting up Brokers...");
    let txSetBroker = new Transaction();
    for (const brokerId of allowedBrokerList) {
        console.log("Broker Id:", brokerId);
        const brokerHash = utils.getBrokerHash(brokerId);
        console.log("Broker Hash:", brokerHash);
        const codedBrokerHash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'));
        const brokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
        console.log("BrokerPda", brokerPda.toBase58());
        const oappConfigPda = utils.getOAppConfigPda(OAPP_PROGRAM_ID);

        try {
            const brokerStatus = await OAppProgram.account.allowedBroker.fetch(brokerPda);
            if (brokerStatus.allowed) {
                console.log("Broker already allowed");
                continue;
            } 
        } catch (err) {
            console.log("Broker PDA not exist");

        }

        const allowed = true;
        const setBrokerParams = {
            brokerHash: codedBrokerHash,
            allowed: allowed,
        };
        const setBrokerAccounts = {
            admin: useMultisig? multisig : wallet.publicKey,
            allowedBroker: brokerPda,
            oappConfig: oappConfigPda,
        }
        const ixSetBroker = await OAppProgram.methods.setBroker(setBrokerParams).accounts(setBrokerAccounts).instruction();

        // const txSetBroker = new Transaction().add(ixSetBroker);
        txSetBroker.add(ixSetBroker);   
        console.log(`Accounts to add broker ${brokerId}: `, setBrokerAccounts);  
        console.log(`Params to add broker ${brokerId}: `, setBrokerParams); 
    }


    if (useMultisig) {
        // console.log(txSetBroker);
        const txBase58 = await utils.getBase58Tx(provider, wallet.publicKey, txSetBroker);
        console.log("txBase58 for set broker:\n", txBase58);
    } else {
        console.log(`Setting up Broker ...`);  // ${brokerId} 
        const sigSetBroker = await sendAndConfirmTransaction(
            provider.connection,
            txSetBroker,
            [wallet.payer],
            {
                commitment: "confirmed",
                preflightCommitment: "confirmed"
            }
        )
        console.log("sigSetBroker", sigSetBroker);
    }
}
setBroker();