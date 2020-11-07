module.exports = async function deploy(commonData) {

    var FactoryOfFactories = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories');
    var factoryOfFactories = new web3.eth.Contract(FactoryOfFactories.abi);

    var dfoFactoryBytecode = await require("./dfoFactory")(commonData);
    var subDAOFactoryBytecode = await require("./subDAOFactory")(commonData);
    //var delegationFactoryBytecode = await require("./delegationFactory")(commonData);
    var farmingFactoryBytecode = await require("./farmingFactory")(commonData);
    var fixedInflationFactoryBytecode = await require("./fixedInflationFactory")(commonData);

    var deployParams = web3.eth.abi.encodeParameters(
        ["address[]", "bytes[][]"],
        [
            [commonData.fromAddress, commonData.fromAddress, commonData.fromAddress, commonData.fromAddress],
            [[dfoFactoryBytecode], [subDAOFactoryBytecode], [farmingFactoryBytecode], [fixedInflationFactoryBytecode]]
        ]
    );

    deployParams = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.OS_ADDRESS, deployParams])
    deployParams = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.fromAddress, deployParams])

    console.log("Creating Factory Of Factories and 4 Factories");
    var contract = await deployContract(factoryOfFactories, FactoryOfFactories.bin, [deployParams], {from : commonData.from});

    commonData.FACTORY_OF_FACTORIES = contract.options.address;

    commonData.factoryIndices = {
        dfo : 0,
        subdao : 1,
        farming : 2,
        fixedInflation : 3
    };
    commonData.DFO_FACTORY = (await blockchainCall(contract.methods.get, 0))[1][0]
    commonData.SUBDAO_FACTORY = (await blockchainCall(contract.methods.get, 1))[1][0]
    commonData.FARMING_FACTORY = (await blockchainCall(contract.methods.get, 2))[1][0]
    commonData.FIXED_INFLATION_FACTORY = (await blockchainCall(contract.methods.get, 3))[1][0]

    console.log("\n -> FOF", contract.options.address, "\n");
    console.log(" -> DFO Factory (0)", commonData.DFO_FACTORY, "\n");
    console.log(" -> SubDAO Factory (1)", commonData.SUBDAO_FACTORY, "\n");
    console.log(" -> Farming Factory (2)", commonData.FARMING_FACTORY, "\n");
    console.log(" -> FixedInflation Factory (3)", commonData.FIXED_INFLATION_FACTORY, "\n");

    return commonData;
}