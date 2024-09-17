import * as utils from "./utils";
import * as constants from "./constants";
import { PublicKey } from "@solana/web3.js";
const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  

async function createLookupTable() {
    const lookupTableList = utils.printPda(OAPP_PROGRAM_ID, wallet, rpc);
    // console.log("Lookup Table List:", lookupTableList);
    
     let lookupTableAddress = await utils.getLookupTableAddress(provider, wallet, rpc, OAPP_PROGRAM_ID);
    console.log("Lookup Table Address:", lookupTableAddress.toBase58());

    await utils.extendLookupTable(provider, wallet, lookupTableAddress, lookupTableList);
    
}

createLookupTable();
