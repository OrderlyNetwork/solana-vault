import * as utils from "./utils";


const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  
const ENV = utils.getEnv(OAPP_PROGRAM_ID);
utils.printPda(OAPP_PROGRAM_ID, wallet, rpc, ENV);








