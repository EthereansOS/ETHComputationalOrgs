var keccak = require('keccak');

module.exports = async function deploy(commonData) {

    console.log("Creating ProposalsManagerLibrary");
    var ProposalsManagerLibrary = await compile('base/impl/ProposalsManager', "ProposalsManagerLibrary");
    var proposalsManagerLibrary = await deployContract(new web3.eth.Contract(ProposalsManagerLibrary.abi), ProposalsManagerLibrary.bin, undefined, {from : commonData.from});

    var path = ProposalsManagerLibrary.ast.absolutePath + ":" + ProposalsManagerLibrary.contractName;
    var key = '__$' + keccak('keccak256').update(path).digest().toString('hex').slice(0, 34) + '$__';

    var ProposalsManager = await compile('base/impl/ProposalsManager', "ProposalsManager");
    ProposalsManager.bin = ProposalsManager.bin.split(key).join(proposalsManagerLibrary.options.address.substring(2));

    console.log("Creating Model ProposalsManager");
    var contract = await deployContract(new web3.eth.Contract(ProposalsManager.abi), ProposalsManager.bin, ["0x"], {from : commonData.from});
    commonData.models = commonData.models || {};
    commonData.models[ProposalsManager.contractName] = contract.options.address;
    console.log(" -> ", contract.options.address, "\n");

    return commonData;
}