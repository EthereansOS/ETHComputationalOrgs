module.exports = async function deploy(commonData) {

    console.log("Creating DelegationFactory");

    var modelAddress = commonData.models.SubDAO;

    var values = [
        commonData.models.ProposalsManager,//active
        commonData.models.TreasuryManager,
        commonData.models.DelegationTokensManager
    ];

    var valuesKeys = [
        commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER,
        commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER,
        commonData.grimoire.COMPONENT_KEY_TOKENS_MANAGER
    ];

    var actives = values.map(() => false);
    actives[0] = true;
    actives[2] = true;

    delegationProposalModels = [
        commonData.models.DelegationsManagerAttacherProposal,
        commonData.models.ChangeOrganizationUriProposal,
        commonData.models.DelegationChangeRulesProposal,
        commonData.models.DelegationTransferManagerProposal,
        commonData.models.VoteProposal
    ]

    var subDAOProposalModelTypes = [
        "address",
        "string",
        "bool",
        "bytes[]",
        "bytes32[]",
        "address",
        "address",
        "uint256",
        "address[][]",
        "address[][]"
    ];

    var subDAOProposalModels = delegationProposalModels.map(it => ({
        source : it,
        uri : "str",
        perpetual : false,
        bytes : [],
        bytes32 : [],
        a : utilities.voidEthereumAddress,
        b : utilities.voidEthereumAddress,
        c : 0,
        d : [[utilities.voidEthereumAddress]],
        e : [[utilities.voidEthereumAddress]]
    }));

    var delegationFactoryBytecode = abi.encode([
        "address",
        `tuple(address,string,string,string)`,
        "uint256",
        `tuple(${subDAOProposalModelTypes.join(',')})[]`
    ], [
        commonData.ITEM_PROJECTION_FACTORY,
        Object.values(commonData.delegationFactoryCollectionHeader),
        commonData.presetValues,
        subDAOProposalModels.map(it => Object.values(it))
    ]);

    delegationFactoryBytecode = abi.encode([
        "address",
        "address[]",
        "bytes32[]",
        "bool[]",
        "bytes"
    ], [
        commonData.PROPOSAL_MODELS_FACTORY,
        values,
        valuesKeys,
        actives,
        delegationFactoryBytecode
    ]);

    var ethereansFactoryInitializerType = [
        "uint256",
        "address",
        "address",
        "uint256",
        "address",
        "address",
        "uint256",
        "address",
        "bytes"
    ]

    var ethereansFactoryInitializerData = [
        0,
        utilities.voidEthereumAddress,
        utilities.voidEthereumAddress,
        0,
        utilities.voidEthereumAddress,
        utilities.voidEthereumAddress,
        0,
        utilities.voidEthereumAddress,
        delegationFactoryBytecode
    ]

    delegationFactoryBytecode = abi.encode([`tuple(${ethereansFactoryInitializerType.join(',')})`], [ethereansFactoryInitializerData]);

    delegationFactoryBytecode = web3.eth.abi.encodeParameters(["address", "bytes"], [modelAddress, delegationFactoryBytecode]);

    delegationFactoryBytecode = web3.eth.abi.encodeParameters(["string", "address", "bytes"], [commonData.delegationFactoryUri, commonData.DYNAMIC_URI_RESOLVER, delegationFactoryBytecode]);

    delegationFactoryBytecode = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.fromAddress, delegationFactoryBytecode]);

    var OrganizationFactory = await compile('ethereans/factories/impl/DelegationFactory');
    var organizationFactoryBytecode = new web3.eth.Contract(OrganizationFactory.abi).deploy({ data: OrganizationFactory.bin, arguments: [delegationFactoryBytecode] }).encodeABI();

    var FactoryOfFactories = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories');
    var factoryOfFactories = new web3.eth.Contract(FactoryOfFactories.abi, commonData.FACTORY_OF_FACTORIES);

    var delegation = await factoryOfFactories.methods.size().call()

    await blockchainCall(factoryOfFactories.methods.create, [commonData.fromAddress], [[organizationFactoryBytecode]], {from:commonData.from});

    commonData.factoryIndices = {...commonData.factoryIndices, delegation};
    commonData.DELEGATION_FACTORY = (await blockchainCall(factoryOfFactories.methods.get, delegation))[1][0]
    console.log(" -> ", commonData.DELEGATION_FACTORY, "\n");

    return commonData;
}