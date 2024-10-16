import * as utils from "./utils";
import * as constants from "./constants";
import { PublicKey } from "@solana/web3.js";
const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  
const ENV = utils.getEnv(OAPP_PROGRAM_ID);

async function createLookupTable() {
    const lookupTableList = utils.printPda(OAPP_PROGRAM_ID, wallet, rpc, ENV);
    // console.log("Lookup Table List:", lookupTableList);
    
    const lookupTableAddress = await utils.getLookupTableAddress(ENV);
    console.log("Lookup Table Address:", lookupTableAddress.toBase58());

    await utils.extendLookupTable(provider, wallet, lookupTableAddress, lookupTableList);
    
}

createLookupTable();
