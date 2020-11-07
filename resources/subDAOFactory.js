module.exports = async function deploy(commonData) {

    console.log("Generating SubDAOFactory Bytecode");

    var modelAddress = commonData.models.SubDAO;

    var values = [
        commonData.models.ProposalsManager,//active
        commonData.models.TreasuryManager,
        commonData.models.StateManager,
        commonData.models.TreasurySplitterManager,
        commonData.models.SubDAOsManager,
        commonData.models.DelegationsManager,
        commonData.models.InvestmentsManager
    ];

    var valuesKeys = [
        commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER,
        commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER,
        commonData.grimoire.COMPONENT_KEY_STATE_MANAGER,
        commonData.grimoire.COMPONENT_KEY_TREASURY_SPLITTER_MANAGER,
        commonData.grimoire.COMPONENT_KEY_SUBDAOS_MANAGER,
        commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER,
        commonData.grimoire.COMPONENT_KEY_INVESTMENTS_MANAGER
    ];

    var actives = values.map(() => false);
    actives[0] = true;

    var organizationFactoryLazyInitData = {
        feePercentageForTransacted: "0",
        feeReceiver: utilities.voidEthereumAddress,
        tokenToTransferOrBurnAddressInCreation: utilities.voidEthereumAddress,
        transferOrBurnAmountInCreation: "0",
        transferOrBurnReceiverInCreation: utilities.voidEthereumAddress,
        tokenToTransferOrBurnAddressInApplication: utilities.voidEthereumAddress,
        transferOrBurnAmountInApplication: "0",
        transferOrBurnReceiverInApplication: utilities.voidEthereumAddress,
        factoryLazyInitData: web3.eth.abi.encodeParameters(["address[]", "bytes32[]", "bool[]", "string", "uint256", "uint256"], [values, valuesKeys, actives, "", commonData.delegationsMaxSize, commonData.presetValues])
    }

    var data = abi.encode(["tuple(uint256,address,address,uint256,address,address,uint256,address,bytes)"], [Object.values(organizationFactoryLazyInitData)]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [modelAddress, data]);
    data = web3.eth.abi.encodeParameters(["string", "address", "bytes"], [commonData.delegationFactoryUri, commonData.DYNAMIC_URI_RESOLVER, data]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.fromAddress, data]);

    var OrganizationFactory = await compile('ethereans/factories/impl/SubDAOFactory');
    var organizationFactoryBytecode = new web3.eth.Contract(OrganizationFactory.abi).deploy({ data: OrganizationFactory.bin, arguments: [data] }).encodeABI();

    return organizationFactoryBytecode;

    var FactoryOfFactories = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories');
    var factoryOfFactories = new web3.eth.Contract(FactoryOfFactories.abi, commonData.FACTORY_OF_FACTORIES);

    var subDAO = await factoryOfFactories.methods.size().call()

    await blockchainCall(factoryOfFactories.methods.create, [commonData.fromAddress], [''], [[organizationFactoryBytecode]], {from:commonData.from});

    commonData.factoryIndices = {...commonData.factoryIndices, subDAO};
    commonData.SUBDAO_FACTORY = (await blockchainCall(factoryOfFactories.methods.get, subDAO))[2][0]
    console.log(" -> ", commonData.SUBDAO_FACTORY, "\n");

    return commonData;
}