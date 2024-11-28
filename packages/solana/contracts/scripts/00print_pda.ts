import * as utils from "./utils";


const [provider, wallet, rpc] = utils.setAnchor();
const ENV = utils.getEnv();
const OAPP_PROGRAM_ID = utils.getProgramID(ENV);

utils.printPda(OAPP_PROGRAM_ID, wallet, rpc, ENV);








