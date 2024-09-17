import * as utils from "./utils";


const [provider, wallet, rpc] = utils.setAnchor();
const [OAPP_PROGRAM_ID, OAppProgram] = utils.getDeployedProgram();  

utils.printPda(OAPP_PROGRAM_ID, wallet, rpc);








