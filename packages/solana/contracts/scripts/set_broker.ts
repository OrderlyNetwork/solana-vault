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
    const useMultisig = false;
    const allowedBrokerList = utils.getBrokerList(ENV);

    const brokerManager = useMultisig ? multisig : wallet.publicKey;

    const brokerManagerRoleHash = utils.getManagerRoleHash(constants.BROKER_MANAGER_ROLE)
    const codedBrokerManagerRoleHash = Array.from(Buffer.from(brokerManagerRoleHash.slice(2), 'hex'));
    const brokerManagerRolePda = utils.getManagerRolePdaWithBuf(OAPP_PROGRAM_ID, codedBrokerManagerRoleHash, brokerManager)

    let setBrokerParams = {
        brokerManagerRole: codedBrokerManagerRoleHash,
        brokerHash: undefined,
        allowed: undefined,
    }
    let setBrokerAccounts = {
        brokerManager: useMultisig ? multisig : wallet.publicKey,
        allowedBroker: undefined,
        managerRole: brokerManagerRolePda,
        systemProgram: SystemProgram.programId,
    }

    console.log("Setting up Brokers...");
    let txSetBroker = new Transaction();
    for (const brokerId of allowedBrokerList) {
        console.log("Broker Id:", brokerId);
        const brokerHash = utils.getBrokerHash(brokerId);
        console.log("Broker Hash:", brokerHash);
        const codedBrokerHash = Array.from(Buffer.from(brokerHash.slice(2), 'hex'));
        const brokerPda = utils.getBrokerPda(OAPP_PROGRAM_ID, brokerHash);
        console.log("BrokerPda", brokerPda.toBase58());

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
        setBrokerParams.allowed = allowed;
        setBrokerParams.brokerHash = codedBrokerHash;
        setBrokerAccounts.allowedBroker = brokerPda;
        const ixSetBroker = await OAppProgram.methods.setBroker(setBrokerParams).accounts(setBrokerAccounts).instruction();

        txSetBroker.add(ixSetBroker);   
        // console.log(`Accounts to add broker ${brokerId}: `); 
        // console.log(`   Broker Manager: `, setBrokerAccounts.brokerManager.toBase58());
        // console.log(`   Allowed Broker PDA: `, setBrokerAccounts.allowedBroker.toBase58());
        // console.log(`   Manager Role PDA: `, setBrokerAccounts.managerRole.toBase58());
        // console.log(`Params to add broker ${brokerId}: `, setBrokerParams); 
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