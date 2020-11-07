module.exports = async function deploy(hostAddress, from, factoryOfFactories, dynamicUriResolverAddress) {

    var Contracts = [
        ...Object.values((await compile('ext/proposals/GeneralRules.sol'))).filter(it => it.abi),
        ...Object.values((await compile('ext/proposals/ProposalCanTerminates.sol'))).filter(it => it.abi),
        ...Object.values((await compile('ext/proposals/ProposalValidators.sol'))).filter(it => it.abi)
    ];

    var modelCodes = Contracts.map(Contract => new web3.eth.Contract(Contract.abi).deploy({data : Contract.bin}).encodeABI());
    var uris = modelCodes.map(() => "myUri");
    var factoryBytecode = abi.encode(["bytes[]", "string[]"], [modelCodes, uris])

    factoryBytecode = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, factoryBytecode])
    factoryBytecode = web3.eth.abi.encodeParameters(["string", "address", "bytes"], ["", dynamicUriResolverAddress, factoryBytecode])
    factoryBytecode = web3.eth.abi.encodeParameters(["address", "bytes"], [hostAddress, factoryBytecode])

    var ProposalModelsFactory = await compile('ethereans/factories/impl/ProposalModelsFactory')
    factoryBytecode = new web3.eth.Contract(ProposalModelsFactory.abi).deploy({data : ProposalModelsFactory.bin, arguments : [factoryBytecode]}).encodeABI()

    await blockchainCall(factoryOfFactories.methods.create, [hostAddress], [''], [[factoryBytecode]], {from})

}