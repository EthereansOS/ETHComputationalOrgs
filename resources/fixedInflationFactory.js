module.exports = async function deploy(commonData) {

    console.log("Generating FixedInflation Bytecode");

    var modelAddress = commonData.models.FixedInflationUniV3;

    var organizationFactoryLazyInitData = {
        feePercentageForTransacted: "0",
        feeReceiver: utilities.voidEthereumAddress,
        tokenToTransferOrBurnAddressInCreation: utilities.voidEthereumAddress,
        transferOrBurnAmountInCreation: "0",
        transferOrBurnReceiverInCreation: utilities.voidEthereumAddress,
        tokenToTransferOrBurnAddressInApplication: commonData.OS_ADDRESS,
        transferOrBurnAmountInApplication: "0",
        transferOrBurnReceiverInApplication: utilities.voidEthereumAddress,
        factoryLazyInitData: web3.eth.abi.encodeParameter("address", commonData.models.FixedInflationExtension)
    }

    var data = abi.encode(["tuple(uint256,address,address,uint256,address,address,uint256,address,bytes)"], [Object.values(organizationFactoryLazyInitData)]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [modelAddress, data]);
    data = web3.eth.abi.encodeParameters(["string", "address", "bytes"], [commonData.fixedInflationFactoryUri, commonData.DYNAMIC_URI_RESOLVER, data]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.fromAddress, data]);

    var Factory = await compile('ethereans/factories/impl/FixedInflationFactory');
    var factoryBytecode = new web3.eth.Contract(Factory.abi).deploy({ data: Factory.bin, arguments: [data] }).encodeABI();

    return factoryBytecode;

    var FactoryOfFactories = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories');
    var factoryOfFactories = new web3.eth.Contract(FactoryOfFactories.abi, commonData.FACTORY_OF_FACTORIES);

    var dfo = await factoryOfFactories.methods.size().call();

    await blockchainCall(factoryOfFactories.methods.create, [commonData.fromAddress], [''], [[organizationFactoryBytecode]], {from:commonData.from});

    commonData.factoryIndices = {...commonData.factoryIndices, dfo};
    commonData.DFO_FACTORY = (await blockchainCall(factoryOfFactories.methods.get, dfo))[2][0]
    console.log(" -> ", commonData.DFO_FACTORY, "\n");

    return commonData;
}