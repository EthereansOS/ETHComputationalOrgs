async function getBytecode(path, contract, compilerVersion) {
    var Contracts = await compile(path, contract, compilerVersion);
    Contracts = Contracts.abi ? [Contracts] : Object.values(Contracts);
    Contracts = Contracts.filter(it => it.abi && it.bin);
    Contracts.forEach(it => console.log(`Generating ${it.contractName} bytecode`));
    return Contracts;
}
module.exports = async function deploy(commonData) {

    var proposalModels = [
        ...(await getBytecode('ext/proposals/GeneralRules')),
        ...(await getBytecode('ext/proposals/ProposalCanTerminates')),
        ...(await getBytecode('ext/proposals/ProposalValidators'))
    ];

    var proposalModelsCode = proposalModels.map(it => "0x" + it.bin)

    var proposalModelsUri = proposalModelsCode.map(() => "URI_TO_REPLACE");

    var proposalSingletons = [];

    var data = web3.eth.abi.encodeParameters(["bytes[]", "string[]", "bytes[]"], [proposalModelsCode, proposalModelsUri, proposalSingletons]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, data]);
    data = web3.eth.abi.encodeParameters(["string", "address", "bytes"], [commonData.proposalsFactoryUri, commonData.DYNAMIC_URI_RESOLVER, data]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.fromAddress, data]);

    console.log("Creating Proposal Models Factory");
    var ProposalModelsFactory = await compile('ethereans/factories/impl/ProposalModelsFactory');
    var proposalModelsFactory = await deployContract(new web3.eth.Contract(ProposalModelsFactory.abi), ProposalModelsFactory.bin, [data], {from : commonData.from});

    commonData.PROPOSAL_MODELS_FACTORY = proposalModelsFactory.options.address;
    console.log(" -> ", commonData.PROPOSAL_MODELS_FACTORY, "\n");

    commonData.models = commonData.models || {};

    await Promise.all(proposalModels.map(async (it, i) => commonData.models[it.contractName] = (await blockchainCall(proposalModelsFactory.methods.model, i))[0]))

    return commonData;
}