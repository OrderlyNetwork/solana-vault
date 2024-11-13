import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { OftTools } from "@layerzerolabs/lz-solana-sdk-v2";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import * as utils from "./utils";
import * as constants from "./constants";

const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram(); 
const ENV = utils.getEnv(OAPP_PROGRAM_ID);

async function setBroker() {
    const allowedBrokerList = utils.getBrokerList(ENV);
    console.log("Allowed Broker List:", allowedBrokerList);
    console.log("Setting up Brokers...");

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
        const ixSetBroker = await OAppProgram.methods.setBroker(setBrokerParams).accounts({
            admin: wallet.publicKey,
            allowedBroker: brokerPda,
            oappConfig: oappConfigPda,
        }).instruction();

        const txSetBroker = new Transaction().add(ixSetBroker);
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