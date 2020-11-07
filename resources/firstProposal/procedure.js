const fs = require('fs');
const path = require('path');

async function createChangeOrganizationUriProposalModel(commonData) {
    console.log("Deploying new Change Organization Uri Proposal Model");
    var ChangeOrganizationUriProposal = await compile('ext/proposals/GeneralRules', 'ChangeOrganizationUriProposal');
    var changeOrganizationUriProposal = await deployContract(new web3.eth.Contract(ChangeOrganizationUriProposal.abi), ChangeOrganizationUriProposal.bin, undefined, {from: commonData.from});
    commonData.models.ChangeOrganizationUriProposal = changeOrganizationUriProposal.options.address;
    return commonData;
}

async function createFixedDelegationsManagerAttacherModel(commonData) {
    console.log("Deploying new Delegations Manager Attacher Proposal Model");
    var DelegationsManagerAttacherProposal = await compile('ext/delegation/impl/DelegationProposals', 'DelegationsManagerAttacherProposal');
    var delegationsManagerAttacherProposal = await deployContract(new web3.eth.Contract(DelegationsManagerAttacherProposal.abi), DelegationsManagerAttacherProposal.bin, undefined, {from: commonData.from});
    commonData.models.DelegationsManagerAttacherProposal = delegationsManagerAttacherProposal.options.address;
    return commonData;
}

async function createFixedDelegationTransferManagerProposalModel(commonData) {
    console.log("Deploying new Delegation Transfer Manager Proposal Model");
    var DelegationTransferManagerProposal = await compile('ext/delegation/impl/DelegationProposals', 'DelegationTransferManagerProposal');
    var delegationTransferManagerProposal = await deployContract(new web3.eth.Contract(DelegationTransferManagerProposal.abi), DelegationTransferManagerProposal.bin, undefined, {from: commonData.from});
    commonData.models.DelegationTransferManagerProposal = delegationTransferManagerProposal.options.address;
    return commonData;
}

async function createFixedDelegationVoteProposalModel(commonData) {
    console.log("Deploying new Delegation Vote Proposal Model");
    var VoteProposal = await compile('ext/delegation/impl/DelegationProposals', 'VoteProposal');
    var voteProposal = await deployContract(new web3.eth.Contract(VoteProposal.abi), VoteProposal.bin, undefined, {from: commonData.from});
    commonData.models.VoteProposal = voteProposal.options.address;
    return commonData;
}

async function createFixedDelegationProposalModel(commonData) {
    console.log("Deploying new Delegation Fixed Proposal Model");
    var DelegationChangeRulesProposal = await compile('ext/delegation/impl/DelegationProposals', 'DelegationChangeRulesProposal');
    var changeRulesProposal = await deployContract(new web3.eth.Contract(DelegationChangeRulesProposal.abi), DelegationChangeRulesProposal.bin, undefined, {from: commonData.from});
    commonData.models.DelegationChangeRulesProposal = changeRulesProposal.options.address;
    return commonData;
}

async function createFixedTokensFromETHModel(commonData) {
    console.log("Deploying new TokensFromETH Model");
    var ChangeInvestmentsManagerFourTokensFromETHList = await compile('ethereans/proposals/EthereansSubDAO', 'ChangeInvestmentsManagerFourTokensFromETHList');
    var changeInvestmentsManagerFourTokensFromETHList = await deployContract(new web3.eth.Contract(ChangeInvestmentsManagerFourTokensFromETHList.abi), ChangeInvestmentsManagerFourTokensFromETHList.bin, undefined, {from: commonData.from});
    commonData.models.ChangeInvestmentsManagerFourTokensFromETHList = changeInvestmentsManagerFourTokensFromETHList.options.address;
    return commonData;
}

async function createFixedTokensToETHModel(commonData) {
    console.log("Deploying new TokensToETH Model");
    var ChangeInvestmentsManagerFiveTokensToETHList = await compile('ethereans/proposals/EthereansSubDAO', 'ChangeInvestmentsManagerFiveTokensToETHList');
    var changeInvestmentsManagerFiveTokensToETHList = await deployContract(new web3.eth.Contract(ChangeInvestmentsManagerFiveTokensToETHList.abi), ChangeInvestmentsManagerFiveTokensToETHList.bin, undefined, {from: commonData.from});
    commonData.models.changeInvestmentsManagerFiveTokensToETHList = changeInvestmentsManagerFiveTokensToETHList.options.address;
    return commonData;
}

async function createNewDelegationTokensManagerModel(commonData) {
    console.log("Creating New Delegation Tokens Manager Model");
    var DelegationTokensManager = await compile('ext/delegation/impl/DelegationTokensManager');
    var delegationTokensManager = await deployContract(new web3.eth.Contract(DelegationTokensManager.abi), DelegationTokensManager.bin, ["0x"], {from: commonData.from});
    commonData.models.DelegationTokensManager = delegationTokensManager.options.address;
    return commonData;
}

async function deployNewDelegationFactory(commonData) {

    console.log("Creating New DelegationFactory");

    var modelAddress = commonData.models.SubDAO;

    var values = [
        commonData.models.ProposalsManager,//active
        commonData.models.TreasuryManager,
        commonData.models.DelegationTokensManager//active
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

    var delegation = commonData.factoryIndices.delegation;

    await blockchainCall(factoryOfFactories.methods.add, [commonData.factoryIndices.delegation], [[organizationFactoryBytecode]], {from: commonData.from});

    commonData.DELEGATION_FACTORY = (await blockchainCall(factoryOfFactories.methods.get, delegation))[1];
    commonData.DELEGATION_FACTORY = commonData.DELEGATION_FACTORY[commonData.DELEGATION_FACTORY.length - 1];
    console.log(" -> ", commonData.DELEGATION_FACTORY, "\n");

    return commonData;
}

async function createNewDelegationsManagerInstanceAndModel(commonData) {

    console.log("Creating Delegations Manager Insurance retriever");
    var DelegationsManagerAttachInsuranceRetriever = await compile('ethereans/util/DelegationsManagerAttachInsuranceRetriever');
    var delegationsManagerAttachInsuranceRetriever = await deployContract(new web3.eth.Contract(DelegationsManagerAttachInsuranceRetriever.abi), DelegationsManagerAttachInsuranceRetriever.bin, undefined, {from : commonData.from});

    console.log("Deploying new Delegations Manager Instance and Model");
    var deployData = web3.eth.abi.encodeParameters([
        "uint256", "address", "bytes32", "bytes"
    ], [
        0,
        delegationsManagerAttachInsuranceRetriever.options.address,
        utilities.voidBytes32,
        web3.eth.abi.encodeParameters(["address[]", "address[]"], [[commonData.DELEGATION_FACTORY], []])
    ]);

    deployData = web3.eth.abi.encodeParameters([
        "uint256", "address", "uint256", "bytes"
    ], [
        commonData.executorRewardPercentage,
        commonData.ITEM_MAININTERFACE,
        commonData.OS_ID,
        deployData
    ]);

    deployData = web3.eth.abi.encodeParameters(["uint256", "address", "bytes"], [
        commonData.delegationsMaxSize,
        commonData.models.TreasuryManager,
        deployData
    ]);

    deployData = web3.eth.abi.encodeParameters(["address", "bytes"], [
        commonData.ourDFO,
        deployData
    ]);

    var DelegationsManager = await compile('ext/delegationsManager/impl/DelegationsManager');
    var delegationsManager = await deployContract(new web3.eth.Contract(DelegationsManager.abi), DelegationsManager.bin, [deployData], {from: commonData.from});
    commonData.models.DelegationsManager = delegationsManager.options.address;
    return commonData;
}

async function deployNewDFOFactory(commonData) {
    console.log("Creating New DFOFactory");

    var FactoryOfFactories = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories');
    var factoryOfFactories = new web3.eth.Contract(FactoryOfFactories.abi, commonData.FACTORY_OF_FACTORIES);

    var factoryBytecode = await require('../dfoFactory')(commonData)
    var index = commonData.factoryIndices.dfo;

    await blockchainCall(factoryOfFactories.methods.add, [index], [[factoryBytecode]], {from: commonData.from});

    commonData.DFO_FACTORY = (await blockchainCall(factoryOfFactories.methods.get, index))[1];
    commonData.DFO_FACTORY = commonData.DFO_FACTORY[commonData.DFO_FACTORY.length - 1];
    console.log(" -> ", commonData.DFO_FACTORY, "\n");

    return commonData;
}

async function deployNewSubDAOFactory(commonData) {
    console.log("Creating New SubDAOFactory");

    var FactoryOfFactories = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories');
    var factoryOfFactories = new web3.eth.Contract(FactoryOfFactories.abi, commonData.FACTORY_OF_FACTORIES);

    var factoryBytecode = await require('../subDAOFactory')(commonData);
    var index = commonData.factoryIndices.subdao;

    await blockchainCall(factoryOfFactories.methods.add, [index], [[factoryBytecode]], {from: commonData.from});

    commonData.SUBDAO_FACTORY = (await blockchainCall(factoryOfFactories.methods.get, index))[1];
    commonData.SUBDAO_FACTORY = commonData.SUBDAO_FACTORY[commonData.SUBDAO_FACTORY.length - 1];
    console.log(" -> ", commonData.SUBDAO_FACTORY, "\n");

    return commonData;
}

async function generateProposalBytecode(commonData) {
    console.log("Generating Proposal Bytecode");

    var proposalPathInput = path.resolve(__dirname, 'FirstProposal.sol');
    var firstProposalCode = fs.readFileSync(proposalPathInput, 'UTF-8');
    console.log(JSON.stringify(firstProposalCode))

    var FirstProposal = await compile('../resources/firstProposal/FirstProposal', 'FirstProposal');

    var firstProposalUri = 'ipfs://ipfs/QmWCxq12MkRhUuPTXNPo3wbCgcoXjqSVeD7Jx3pbVJ3LM7';

    var SubDAO = await compile('ext/subDAO/impl/SubDAO');
    var subDAO = new web3.eth.Contract(SubDAO.abi, commonData.ourSubDAO);
    await compile('ext/subDAOsManager/impl/SubDAOsManager');
    await compile('base/impl/StateManager');

    var proposalModelUri = 'ipfs://ipfs/QmYY7awxFQBuSgRZRyERbibVakTrbiv2hAXXS1KepS3sQN';
    var proposalModelPresetValues = [75, 250, 500, 750, 1000, 5000].map(it => utilities.numberToString(it * 1e18));
    var proposalModel = {...(await blockchainCall(subDAO.methods.proposalModels))[1]};
    proposalModel.uri = proposalModelUri;
    proposalModel.presetValues = proposalModelPresetValues.map(it => web3.eth.abi.encodeParameters(["string", "uint256"], ["delegationsAttachInsurance", it]))
    proposalModel.presetProposals = [];
    console.log(JSON.stringify({presetValues : proposalModel.presetValues}))

    var delegationsAttachInsurance = proposalModelPresetValues[1];

    var args = [
        firstProposalUri,
        commonData.models.DelegationsManager,
        commonData.models.ChangeInvestmentsManagerFourTokensFromETHList,
        commonData.models.changeInvestmentsManagerFiveTokensToETHList,
        proposalModel,
        delegationsAttachInsurance
    ]

    var firstProposalBytecode = new web3.eth.Contract(FirstProposal.abi).deploy({data : FirstProposal.bin, arguments: args}).encodeABI();

    return firstProposalBytecode;
}

async function propose(commonData, proposalBytecode) {
    console.log("Generating Proposal");
    var SubDAO = await compile('ext/subDAO/impl/SubDAO');

    var subDAO = new web3.eth.Contract(SubDAO.abi, commonData.ourSubDAO);
    var delegationsManagerAddress = await blockchainCall(subDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER);
    console.log({delegationsManagerAddress})

    var ourSubDAO = subDAO;

    subDAO = new web3.eth.Contract(SubDAO.abi, commonData.ourDFO);
    var ourDFO = subDAO;
    delegationsManagerAddress = await blockchainCall(subDAO.methods.get, commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER);
    console.log({delegationsManagerAddress})

    var proposalsManagerAddress = await blockchainCall(subDAO.methods.get, commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER);
    var ProposalsManager = await compile('base/impl/ProposalsManager');
    var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, proposalsManagerAddress);

    var input = [{
        codes : [{
            location : utilities.voidEthereumAddress,
            bytecode : proposalBytecode
        }],
        alsoTerminate : false
    }];

    await blockchainCall(proposalsManager.methods.batchCreate, input, {from : commonData.from});

    return {
        ourDFO,
        ourSubDAO,
        subDAO,
        proposalsManager
    };
}

async function voteAndTerminate(commonData, proposalsManager, itemMainInterface) {

    var proposalId = await blockchainCall(proposalsManager.methods.lastProposalId)

    var value = await blockchainCall(itemMainInterface.methods.balanceOf, commonData.fromAddress, commonData.OS_ID)
    var voteData = abi.encode(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, "0", utilities.voidEthereumAddress, false])

    await blockchainCall(itemMainInterface.methods.safeTransferFrom, commonData.fromAddress, proposalsManager.options.address, commonData.OS_ID, value, voteData, {from : commonData.from});

    await blockchainCall(proposalsManager.methods.terminate, [proposalId], {from : commonData.from, gasLimit : '9000000'})
    await blockchainCall(proposalsManager.methods.withdrawAll, [proposalId], commonData.fromAddress, true, {from : commonData.from})
}

module.exports = {
    async deploy(commonData) {
        commonData = await createChangeOrganizationUriProposalModel(commonData);
        commonData = await createFixedDelegationsManagerAttacherModel(commonData);
        commonData = await createFixedDelegationTransferManagerProposalModel(commonData);
        commonData = await createFixedDelegationVoteProposalModel(commonData);
        commonData = await createFixedDelegationProposalModel(commonData);
        commonData = await createFixedTokensFromETHModel(commonData);
        commonData = await createFixedTokensToETHModel(commonData);
        commonData = await createNewDelegationTokensManagerModel(commonData);
        commonData = await deployNewDelegationFactory(commonData);

        commonData = await createNewDelegationsManagerInstanceAndModel(commonData);

        commonData = await deployNewDFOFactory(commonData);
        commonData = await deployNewSubDAOFactory(commonData);

        var proposalBytecode = await generateProposalBytecode(commonData);

        var data = await propose(commonData, proposalBytecode);

        return { commonData, data};
    },
    voteAndTerminate
}