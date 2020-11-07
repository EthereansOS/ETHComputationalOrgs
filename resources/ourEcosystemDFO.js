var fs = require('fs');
var path = require('path');

var proposalModelsFactory;

async function retireveProductAddress(transaction) {
    var transactionReceipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
    var log = transactionReceipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Deployed(address,address,address,bytes)'))[0]
    var address = web3.eth.abi.decodeParameter('address', log.topics[2]);
    return address;
}

async function deployModel(commonData, proposalModelsFactory, index, deployData) {
    var transaction = await blockchainCall(proposalModelsFactory.methods.deploy, web3.eth.abi.encodeParameters(["uint256", "bytes"], [index + "", deployData]), {from : commonData.from});
    return await retireveProductAddress(transaction);
}

function validatorsAndTerminates(validators, terminates) {
    return renderArray("validators", validators) + "\n" + renderArray("terminates", terminates);
}

function renderArray(name, array) {
    array = array || [];
    var text = [
        `        address[] memory ${name} = new address[](${array.length});`
    ]
    for(var i in array) {
        var item = web3.utils.toChecksumAddress(array[i]);
        text.push(`        ${name}[${i}] = ${item};`);
    }
    return text.join('\n');
}

async function changeFixedInflationPercentage(commonData) {

    var from = {from : commonData.from};

    var OSFixedInflationManagerChangeDailyInflationPercentage = await compile('ethereans/proposals/EthereansSubDAO', 'OSFixedInflationManagerChangeDailyInflationPercentage');
    var oSFixedInflationManagerChangeDailyInflationPercentage = await deployContract(new web3.eth.Contract(OSFixedInflationManagerChangeDailyInflationPercentage.abi), OSFixedInflationManagerChangeDailyInflationPercentage.bin, ["0x"], from);

    var maxCap25 = await deployModel(commonData, proposalModelsFactory, 3, web3.eth.abi.encodeParameters(["uint256", "bool"], [utilities.numberToString(25 * 1e16), true]))//maxCapPercentage 25%

    var uri = 'ipfs://ipfs/QmPkZjrGUpNSP19oWhdRfoy9YdP7fL9AJtzmgiFR2sekyT';

    return {
        source : oSFixedInflationManagerChangeDailyInflationPercentage.options.address,
        uri,
        isPreset : true,
        presetValues : [
            0.5,
            1,
            3,
            5,
            8,
            15
        ].map(it => utilities.numberToString(it * 1e16)).map(it => web3.eth.abi.encodeParameter("uint256", it)),
        presetProposals : [],
        creationRules : utilities.voidEthereumAddress,
        triggeringRules : utilities.voidEthereumAddress,
        votingRulesIndex : 0,
        canTerminateAddresses : [[]],
        validatorsAddresses : [[maxCap25]]
    }
}

function setUint256Value(_, contract, uri, name, values, validatorContract) {
    return {
        source : contract.options.address,
        uri : "ipfs://ipfs/" + uri,
        isPreset : true,
        presetValues : values.map(it => web3.eth.abi.encodeParameters(["string", "uint256"], [name, it])),
        presetProposals : [],
        creationRules : utilities.voidEthereumAddress,
        triggeringRules : utilities.voidEthereumAddress,
        votingRulesIndex : 0,
        canTerminateAddresses : [[]],
        validatorsAddresses : [[validatorContract]]
    }
}

async function changeTokensToETH(commonData, voteAtCreation, quorum, terminates) {

    var from = {from : commonData.from};

    var ChangeInvestmentsManagerFiveTokensToETHList = await compile('ethereans/proposals/EthereansSubDAO', 'ChangeInvestmentsManagerFiveTokensToETHList');
    var changeInvestmentsManagerFiveTokensToETHList = await deployContract(new web3.eth.Contract(ChangeInvestmentsManagerFiveTokensToETHList.abi), ChangeInvestmentsManagerFiveTokensToETHList.bin, ["0x"], from);

    var uri = 'ipfs://ipfs/QmXGekHsYKbsRkmEUvwm8576wbujosgQbhSBUYqwfoWQLa';

    return {
        source : changeInvestmentsManagerFiveTokensToETHList.options.address,
        uri,
        isPreset : false,
        presetValues : [],
        presetProposals : [],
        creationRules : voteAtCreation,
        triggeringRules : utilities.voidEthereumAddress,
        votingRulesIndex : 0,
        canTerminateAddresses : [terminates],
        validatorsAddresses : [[quorum]]
    }
}

async function changeTokensFromETH(commonData, voteAtCreation, quorum, terminates) {

    var from = {from : commonData.from};

    var ChangeInvestmentsManagerFourTokensFromETHList = await compile('ethereans/proposals/EthereansSubDAO', 'ChangeInvestmentsManagerFourTokensFromETHList');
    var changeInvestmentsManagerFourTokensFromETHList = await deployContract(new web3.eth.Contract(ChangeInvestmentsManagerFourTokensFromETHList.abi), ChangeInvestmentsManagerFourTokensFromETHList.bin, ["0x"], from);

    var uri = 'ipfs://ipfs/QmQWQ49Ah4JFkTsWZExyP3RXpDWvuyCGtF72e2ZitTMhXk';

    return {
        source : changeInvestmentsManagerFourTokensFromETHList.options.address,
        uri,
        isPreset : false,
        presetValues : [],
        presetProposals : [],
        creationRules : voteAtCreation,
        triggeringRules : utilities.voidEthereumAddress,
        votingRulesIndex : 0,
        canTerminateAddresses : [terminates],
        validatorsAddresses : [[quorum]]
    }
}

async function _osMinter(commonData) {
    console.log("OS MINTER");
    var OSMinter = await compile('ethereans/osMinter/impl/OSMinter')
    var osMinter = await deployContract(new web3.eth.Contract(OSMinter.abi), OSMinter.bin, ["0x"], {from : commonData.from})
    return web3.eth.abi.encodeParameters(
        ["bytes32", "address", "bool", "bytes"]
        , [
        commonData.grimoire.COMPONENT_KEY_TOKEN_MINTER,
        osMinter.options.address,
        false,
        web3.eth.abi.encodeParameters(["bool", "bytes"], [false, web3.eth.abi.encodeParameters(["address", "address"], [commonData.OS_PROJECTION, commonData.OS_ADDRESS])])
    ])
}

async function _fixedInlfation(commonData) {
    console.log("fixed inflation");
    var OSFixedInflationManager = await compile('ethereans/osFixedInflationManager/impl/OSFixedInflationManager')
    var oSFixedInflationManager = await deployContract(new web3.eth.Contract(OSFixedInflationManager.abi), OSFixedInflationManager.bin, ["0x"], {from : commonData.from})
    return web3.eth.abi.encodeParameters(
        ["bytes32", "address", "bool", "bytes"]
        , [
        commonData.grimoire.COMPONENT_KEY_TOKEN_MINTER_AUTH,
        oSFixedInflationManager.options.address,
        false,
        web3.eth.abi.encodeParameters(["bool", "bytes"], [true, web3.eth.abi.encodeParameters(["bytes", "bytes", "bytes"],
        [
            web3.eth.abi.encodeParameters(
                ["uint256", "address", "address", "uint256"],
                [
                    web3.eth.abi.encodeParameter("uint256", utilities.numberToString(30 * 1e16)),
                    commonData.fromAddress,
                    commonData.fromAddress,
                    web3.eth.abi.encodeParameter("uint256", utilities.numberToString(25 * 1e16))
                ]
            ), web3.eth.abi.encodeParameters(
                ["uint256", "uint256", "uint256", "address"],
                [
                    commonData.OS_MINT_AUTH.lastTokenPercentage,
                    commonData.ONE_YEAR_IN_BLOCKS,
                    commonData.DAYS_IN_YEAR,
                    commonData.OS_ADDRESS
                ]
            ), web3.eth.abi.encodeParameters(
                ["uint256", "address", "uint256", "uint256"],
                [
                    commonData.executorRewardPercentage,
                    commonData.PRESTO_ADDRESS,
                    commonData.fixedInflationStartBlock || 0,
                    commonData.DAY_IN_BLOCKS
                ]
            )]
        )])
    ])
}

function stateValues(commonData) {
    var keyType = 'tuple(string,bytes32,bytes)';
    var data = [{
        name : commonData.grimoire.STATEMANAGER_ENTRY_NAME_FACTORY_OF_FACTORIES_FEE_PERCENTAGE_FOR_TRANSACTED,
        value : web3.eth.abi.encodeParameter("uint256", utilities.numberToString(0.08 * 1e16))
    }, {
        name : commonData.grimoire.STATEMANAGER_ENTRY_NAME_FACTORY_OF_FACTORIES_FEE_PERCENTAGE_FOR_BURN,
        value : web3.eth.abi.encodeParameter("uint256", utilities.numberToString(0.08 * 1e16))
    }, {
        name : commonData.grimoire.STATEMANAGER_ENTRY_NAME_FARMING_FEE_PERCENTAGE_FOR_TRANSACTED,
        value : web3.eth.abi.encodeParameter("uint256", utilities.numberToString(0.08 * 1e16))
    }, {
        name : commonData.grimoire.STATEMANAGER_ENTRY_NAME_FARMING_FEE_FOR_BURNING_OS,
        value : web3.eth.abi.encodeParameter("uint256", utilities.numberToString(5 * 1e18))
    }, {
        name : commonData.grimoire.STATEMANAGER_ENTRY_NAME_INFLATION_FEE_PERCENTAGE_FOR_TRANSACTED,
        value : web3.eth.abi.encodeParameter("uint256", utilities.numberToString(0.08 * 1e16))
    }]
    data = abi.encode([keyType + "[]"], [data.map(it => [it.name, commonData.grimoire.ENTRY_TYPE_UINT256, it.value])])
    return data;
}

module.exports = async function deploy(commonData) {

    console.log("Deployng our ecosystem (Init)")

    var from = {from : commonData.from}

    var ProposalModelsFactory = await compile('ethereans/factories/impl/ProposalModelsFactory');
    proposalModelsFactory = new web3.eth.Contract(ProposalModelsFactory.abi, commonData.PROPOSAL_MODELS_FACTORY);

    var dfoCreationProposal = await deployModel(commonData, proposalModelsFactory, 0, web3.eth.abi.encodeParameters(["address", "bool"], [commonData.fromAddress, true]));//by specific address
    var dfoValidators = [
        await deployModel(commonData, proposalModelsFactory, 4, web3.eth.abi.encodeParameter("uint256", commonData.DAY_IN_BLOCKS.mul(9))),//validation bomb
        await deployModel(commonData, proposalModelsFactory, 5, web3.eth.abi.encodeParameters(["uint256", "bool"], [utilities.numberToString(10 * 1e16), true])),//quorum percentage
    ];
    var dfoTerminates = [
        await deployModel(commonData, proposalModelsFactory, 2, web3.eth.abi.encodeParameter("uint256", commonData.DAY_IN_BLOCKS.mul(7))),//block length
        await deployModel(commonData, proposalModelsFactory, 3, web3.eth.abi.encodeParameters(["uint256", "bool"], [utilities.numberToString(15 * 1e16), true])),//maxCapPercentage 15%
    ];
    var investmentTerminates = [
        await deployModel(commonData, proposalModelsFactory, 2, web3.eth.abi.encodeParameter("uint256", commonData.DAY_IN_BLOCKS.mul(7))),//block length
        await deployModel(commonData, proposalModelsFactory, 3, web3.eth.abi.encodeParameters(["uint256", "bool"], [utilities.numberToString(20 * 1e16), true])),//maxCapPercentage 20%
    ];

    var maxCap15 = await deployModel(commonData, proposalModelsFactory, 3, web3.eth.abi.encodeParameters(["uint256", "bool"], [utilities.numberToString(15 * 1e16), true]))//maxCapPercentage 15%

    var SetUint256Proposal = await compile('ethereans/proposals/EthereansSubDAO', 'SetUint256Proposal');
    var setUint256Proposal = await deployContract(new web3.eth.Contract(SetUint256Proposal.abi), SetUint256Proposal.bin, ["0x"], from);
    var uri = 'URI_HERE';

    var voteAtCreation = utilities.voidEthereumAddress;
    var quorumPercentageForBuySellTokens = await deployModel(commonData, proposalModelsFactory, 5, web3.eth.abi.encodeParameters(["uint256", "bool"], [utilities.numberToString(10 * 1e16), true]));//quorum percentage

    var proposalModels = [
        await changeFixedInflationPercentage(commonData),
        setUint256Value(commonData, setUint256Proposal, "QmSBSi8STApCH3LtRALMQSA6v7iMka9UYFewY8N4jB9dSN", commonData.grimoire.STATEMANAGER_ENTRY_NAME_FACTORY_OF_FACTORIES_FEE_PERCENTAGE_FOR_TRANSACTED, [0.03, 0.08, 0.3, 0.8, 1, 3].map(it => utilities.numberToString(it * 1e16)), maxCap15),
        setUint256Value(commonData, setUint256Proposal, "Qmee1ibJCtnhu7ChpcsKyXum9KikptJtQrAxeCLer55Aj5", commonData.grimoire.STATEMANAGER_ENTRY_NAME_FACTORY_OF_FACTORIES_FEE_PERCENTAGE_FOR_BURN, [0.03, 0.08, 0.3, 0.8, 1, 3].map(it => utilities.numberToString(it * 1e16)), maxCap15),
        setUint256Value(commonData, setUint256Proposal, "QmR3S8cPGb4Tm9dr7sVx5meUPMsptV6vBbCCP96e2cZeAL", commonData.grimoire.STATEMANAGER_ENTRY_NAME_FARMING_FEE_PERCENTAGE_FOR_TRANSACTED, [0.03, 0.08, 0.3, 0.8, 1, 3].map(it => utilities.numberToString(it * 1e16)), maxCap15),
        setUint256Value(commonData, setUint256Proposal, "QmesA2MjYEjdsC2wFRSfqDmThDASftNZThwWMuhZ7vKQaV", commonData.grimoire.STATEMANAGER_ENTRY_NAME_FARMING_FEE_FOR_BURNING_OS, [0.05, 0.1, 1, 5, 10, 100].map(it => utilities.numberToString(it * 1e18)), maxCap15),
        setUint256Value(commonData, setUint256Proposal, "QmVGor81bynT1GLQoWURiTSdPmPEDbe8eC5znNDHfTfkfT", commonData.grimoire.STATEMANAGER_ENTRY_NAME_INFLATION_FEE_PERCENTAGE_FOR_TRANSACTED, [0.03, 0.08, 0.3, 0.8, 1, 3].map(it => utilities.numberToString(it * 1e16)), maxCap15),
        await changeTokensFromETH(commonData, voteAtCreation, quorumPercentageForBuySellTokens, investmentTerminates),
        await changeTokensToETH(commonData, voteAtCreation, quorumPercentageForBuySellTokens, investmentTerminates)
    ];

    var myselfData = [
        await _osMinter(commonData),
        await _fixedInlfation(commonData)
    ];

    var code = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./ethereans/osMinter/impl/OSMinter.sol";
import "./ethereans/osFixedInflationManager/impl/OSFixedInflationManager.sol";
import "./base/model/IProposalsManager.sol";
import {AddressUtilities, Uint256Utilities, BytesUtilities} from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "./core/model/IOrganization.sol";
import "@ethereansos/swissknife/contracts/factory/model/IFactory.sol";
import "./ethereans/factories/model/IOrganizationFactory.sol";
import "./ext/subDAOsManager/model/ISubDAOsManager.sol";
import "./ext/subDAO/model/ISubDAO.sol";

contract DFODeployer {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using BytesUtilities for bytes;

    bytes private constant EMPTY = bytes("");

    address private sender = msg.sender;
    address public dfo;

    bytes32 public _myselfKey;
    bytes[] public _myselfData;

    function createDFO() external {
        require(sender == msg.sender);
        (dfo,) = IFactory(${commonData.DFO_FACTORY}).deploy(_dfoDeployData());//DFO Factory
        bytes[] memory c = new bytes[](3);
        c[0] = _myselfData[0];
        c[1] = abi.encode(
            ${commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER},
            IOrganization(dfo).get(${commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER}),
            true,
            EMPTY
        );
        c[2] = abi.encode(
            ${commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER},
            IOrganization(dfo).get(${commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER}),
            true,
            EMPTY
        );
        _myselfData = c;
    }

    function myselfData() public view returns(bytes[] memory) {
        return _myselfData;
    }

    function setSubDAO(address subDAO) external {
        require(sender == msg.sender);
        ISubDAOsManager(IOrganization(dfo).get(${commonData.grimoire.COMPONENT_KEY_SUBDAOS_MANAGER})).set(${commonData.grimoire.SUBDAO_KEY_ETHEREANSOS_V1}, subDAO, address(0));
    }

    function set(address organization, IOrganization.Component[] memory components) external {
        require(sender == msg.sender);
        IOrganization(organization).batchSet(components);
    }

    function _dfoDeployData() private returns (bytes memory) {
        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;//Treasury Manager
        ids[1] = 5;//SubDAOs Manager
        ids[2] = 6;//Delegations Manager
        return abi.encode(IOrganizationFactory.OrganizationDeployData(
            "${commonData.ourSubDAOUri}",
            _dfoProposalsManagerDeployData().asSingletonArray(),
            ids,
            _dfoAdditionalComponents(),
            _myselfData = _myself().asSingletonArray(),
            EMPTY
        ));
    }

    function _myself() private returns (bytes memory) {
        return abi.encode(
            _myselfKey = keccak256(abi.encode(block.timestamp, tx.origin, msg.sender, block.number, block.coinbase)),
            address(this),
            true,
            EMPTY
        );
    }

    function _dfoAdditionalComponents() private pure returns(bytes[] memory components) {
        components = new bytes[](3);
        components[1] = abi.encode(new ISubDAOsManager.SubDAOEntry[](0));
        components[2] = _delegationsManager();
    }

    function _delegationsManager() private pure returns (bytes memory) {
        address[] memory allowedFactories = new address[](1);
        allowedFactories[0] = ${web3.utils.toChecksumAddress(commonData.DELEGATION_FACTORY)};
        return abi.encode(
            ${utilities.voidBytes32},
            ${commonData.executorRewardPercentage},
            ${commonData.ITEM_MAININTERFACE},
            ${commonData.OS_ID},
            abi.encode(allowedFactories, new address[](0))
        );
    }

    function _dfoProposalsManagerDeployData() private pure returns (bytes memory) {
        address collection = ${commonData.ITEM_MAININTERFACE};
        uint256 OS_ID = ${commonData.OS_ID};
        uint256 weight = 1;
${validatorsAndTerminates(dfoValidators, dfoTerminates)}
        return abi.encode(IProposalsManager.ProposalConfiguration(
            collection.asSingletonArray(),
            OS_ID.asSingletonArray(),
            weight.asSingletonArray(),
            ${dfoCreationProposal},
            address(0),
            terminates,
            validators
        ));
    }
}`;

    var location = path.resolve(__dirname, '../contracts/DFODeployer.sol');

    try {
        fs.unlinkSync(location);
    } catch(e) {
    }

    fs.writeFileSync(location, code);

    console.log("Deploying Our Ecosystem (DFO Code)");

    var DFODeployer = await compile('DFODeployer');
    var dFODeployer = await deployContract(new web3.eth.Contract(DFODeployer.abi), DFODeployer.bin, undefined, {from : commonData.from});

    console.log("Deploying Our Ecosystem (DFO)");
    await blockchainCall(dFODeployer.methods.createDFO, {from : commonData.from});

    commonData.ourDFO = await blockchainCall(dFODeployer.methods.dfo);
    console.log(" -> DFO -> ", commonData.ourDFO);

    myselfData = [
        ...myselfData,
        ...(await blockchainCall(dFODeployer.methods.myselfData))
    ]

    var subDAOContractLocation = await require('./ourEcosystemSubDAO')(commonData);

    console.log("Deploying Our Ecosystem (SubDAO Code)");
    var SubDAOContract = await compile(subDAOContractLocation);
    var subDAOContract = await deployContract(new web3.eth.Contract(SubDAOContract.abi), SubDAOContract.bin, undefined, {from : commonData.from});

    console.log("Deploying Our Ecosystem (SubDAO)");
    await blockchainCall(subDAOContract.methods.initialize, [], myselfData, stateValues(commonData), {from : commonData.from})

    commonData.ourSubDAO = await blockchainCall(subDAOContract.methods.subDAO);

    console.log("Initializing Proposal Models");
    var SubDAO = await compile('ext/subDAO/impl/SubDAO');
    subDAO = new web3.eth.Contract(SubDAO.abi, commonData.ourSubDAO);
    await blockchainCall(subDAOContract.methods.setInitialProposalModels, proposalModels, {from : commonData.from});

    commonData = await require('./twoFarmings')(commonData)

    console.log("Setting subDAO to Root")
    await blockchainCall(dFODeployer.methods.setSubDAO, commonData.ourSubDAO, {from : commonData.from});

    var components = [{
        key : await blockchainCall(dFODeployer.methods._myselfKey),
        location : utilities.voidEthereumAddress,
        active : false,
        log : true
    }]

    console.log("Releasing root privileges")
    await blockchainCall(dFODeployer.methods.set, commonData.ourDFO, components, {from : commonData.from});

    var components = [{
        key : commonData.grimoire.COMPONENT_KEY_OS_FARMING,
        location : commonData.OS_FARMING,
        active : false,
        log : true
    }, {
        key : commonData.grimoire.COMPONENT_KEY_DIVIDENDS_FARMING,
        location : commonData.DIVIDENDS_FARMING,
        active : false,
        log : true
    }, {
        key : await blockchainCall(dFODeployer.methods._myselfKey),
        location : utilities.voidEthereumAddress,
        active : false,
        log : true
    }]

    console.log("Mounting farming contracts and Releasing subDAO privileges")
    await blockchainCall(dFODeployer.methods.set, commonData.ourSubDAO, components, {from : commonData.from});

    console.log(" -> Subdao -> ", commonData.ourSubDAO);

    console.log("Giving FoF Host to subDAO")
    var FactoryOfFactories = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories');
    var factoryOfFactories = new web3.eth.Contract(FactoryOfFactories.abi, commonData.FACTORY_OF_FACTORIES);
    await blockchainCall(factoryOfFactories.methods.setHost, commonData.ourSubDAO, {from : commonData.from});

    /*if(web3.currentProvider.blockchainConnection) {
        await catchCall(blockchainCall(subDAOContract.methods.setInitialProposalModels, proposalModels, {from : commonData.from}), "already done");
        await catchCall(blockchainCall(dFODeployer.methods.setSubDAO, commonData.ourSubDAO, {from : commonData.from}), "unauthorized");
        await catchCall(blockchainCall(dFODeployer.methods.set, commonData.ourDFO, components, {from : commonData.from}), "unauthorized");
        await catchCall(blockchainCall(dFODeployer.methods.set, commonData.ourSubDAO, components, {from : commonData.from}), "unauthorized");
        var code = {
            location : utilities.voidEthereumAddress,
            bytecode : web3.eth.abi.encodeParameter("uint256", 0)
        }
        code = {
            codes : [code],
            alsoTerminate : false
        }
        code = [code]
        var ProposalsManager = await compile('base/impl/ProposalsManager')
        var proposalsManager = new web3.eth.Contract(ProposalsManager.abi, await blockchainCall(subDAO.methods.get, commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER))
        await blockchainCall(proposalsManager.methods.batchCreate, code, {from : commonData.from})
        var proposalId = await blockchainCall(subDAO.methods.proposalModels)
        proposalId = proposalId[0]
        proposalId = proposalId.presetProposals[0]
        var Item = await compile('../node_modules/@ethereansos/items-v2/contracts/model/Item')
        var item = new web3.eth.Contract(Item.abi, commonData.ITEM_MAININTERFACE)
        var value = utilities.numberToString(5*1e18)
        var data = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [proposalId, value, 0, utilities.voidEthereumAddress, false])
        await blockchainCall(item.methods.safeTransferFrom, commonData.fromAddress, proposalsManager.options.address, commonData.OS_ID, value, data, {from : commonData.from})
    }*/

    return commonData;
}