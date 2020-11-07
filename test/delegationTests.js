var fs = require('fs');
var path = require('path');

var terminates;

async function getDeployedAddress(transaction) {
    transaction = await web3.eth.getTransactionReceipt(
        transaction.transactionHash
    );
    var log = transaction.logs.filter(
        (it) =>
        it.topics[0] ===
        web3.utils.sha3("Deployed(address,address,address,bytes)")
    )[0];
    return web3.eth.abi.decodeParameter("address", log.topics[2]);
}

async function createDelegation(commonData) {
    var FactoryOfFactories = await compile(
        "ethereans/factoryOfFactories/impl/FactoryOfFactories"
    );
    var factoryOfFactories = new web3.eth.Contract(
        FactoryOfFactories.abi,
        commonData.FACTORY_OF_FACTORIES
    );

    var index = commonData.factoryIndices.delegation;
    var delegationFactoryAddress = await blockchainCall(
        factoryOfFactories.methods.get,
        index
    );
    delegationFactoryAddress = delegationFactoryAddress[1];
    delegationFactoryAddress =
        delegationFactoryAddress[delegationFactoryAddress.length - 1];

    var DelegationFactory = await compile(
        "ethereans/factories/impl/DelegationFactory"
    );
    delegationFactory = new web3.eth.Contract(
        DelegationFactory.abi,
        delegationFactoryAddress
    );

    var organizationDeployDataTypes = [
        "string",
        "bytes[]",
        "uint256[]",
        "bytes[]",
        "bytes[]",
        "bytes",
    ];

    var deployData = abi.encode(
        [`tuple(${organizationDeployDataTypes.join(",")})`], [
            [
                "uri", ["0x", "0x", web3.eth.abi.encodeParameter("string", "TICK_TICK")],
                [],
                [],
                [],
                "0x",
            ],
        ]
    );

    var newDelegationAddress = await getDeployedAddress(
        await blockchainCall(delegationFactory.methods.deploy, deployData, {
            from: commonData.from,
        })
    );
    var SubDAO = await compile("ext/subDAO/impl/SubDAO");
    delegation = new web3.eth.Contract(SubDAO.abi, newDelegationAddress);

    await blockchainCall(
        delegationFactory.methods.initializeProposalModels,
        delegation.options.address,
        accounts[0],
        utilities.toDecimals("0.0001", 16),
        0,
        30,
        utilities.toDecimals("0.0001", 16), { from: commonData.from }
    );

    return delegation;
}

async function attach(commonData, data, delegation, suppress) {
    await compile("base/impl/StateManager");
    var ProposalsManager = await compile("base/impl/ProposalsManager");
    var delegationProposalsManagerAddress = await blockchainCall(
        delegation.methods.get,
        commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
    );
    var delegationProposalsManager = new web3.eth.Contract(
        ProposalsManager.abi,
        delegationProposalsManagerAddress
    );
    var codes = [{
        codes: [{
            location: web3.eth.abi.decodeParameter(
                "address",
                web3.eth.abi.encodeParameter("uint256", 0)
            ),
            bytecode: web3.eth.abi.encodeParameters(
                ["string", "address"],
                ["myUri", data.delegationsManager.options.address]
            ),
        }],
        alsoTerminate: true
    }];

    var paidFor = await blockchainCall(data.delegationsManager.methods.paidFor, delegation.options.address, utilities.voidEthereumAddress);
    paidFor = paidFor[0];

    console.log("Before", {paidFor})

    await catchCall(readProposalTerminated(blockchainCall(delegationProposalsManager.methods.batchCreate, codes, {
        from: commonData.from,
        gasLimit: "6000000",
    })), "not valid");

    try {
        await stakeTokens(commonData, data, delegation);
    } catch(e) {
        if(!suppress) {
            throw e;
        }
    }

    paidFor = await blockchainCall(data.delegationsManager.methods.paidFor, delegation.options.address, utilities.voidEthereumAddress);
    paidFor = paidFor[0];

    console.log("After", {paidFor})

    return await readProposalTerminated(blockchainCall(delegationProposalsManager.methods.batchCreate, codes, {
        from: commonData.from,
        gasLimit: "6000000",
    }));
}

async function readProposalTerminated(transaction) {
    if(transaction.then) {
        transaction = await transaction;
    }
    transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash || transaction);
    var log = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalTerminated(bytes32,bool,bytes)'))[0];
    var errorData = abi.decode(["bool","bytes"], log.data);
    if(!errorData[0]) {
        errorData = abi.decode(["address","bytes"], errorData[1])[1];
        errorData = errorData.substring(10);
        errorData = abi.decode(["string"], "0x" + errorData)[0];
        errorData = new Error(errorData);
        errorData.hashes = [transaction.transactionHash];
        throw errorData;
    }
    return transaction;
}

async function stakeTokens(commonData, data, delegation) {
    if (data.collectionAddress === utilities.voidEthereumAddress) {
        if (data.objectId !== utilities.voidEthereumAddress) {
            var IERC20 = await compile(
                "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20"
            );
            var iERC20 = new web3.eth.Contract(
                IERC20.abi,
                web3.eth.abi.decodeParameter(
                    "address",
                    web3.eth.abi.encodeParameter("uint256", data.objectId)
                )
            );
            await blockchainCall(
                iERC20.methods.approve,
                data.delegationsManager.options.address,
                commonData.UINT256_MAX
            );
            await blockchainCall(
                data.delegationsManager.methods.payFor,
                delegation.options.address,
                data.delegationsAttachInsurance,
                "0x",
                commonData.fromAddress
            );
        } else {
            await blockchainCall(
                data.delegationsManager.methods.payFor,
                delegation.options.address,
                data.delegationsAttachInsurance,
                "0x",
                commonData.fromAddress, {
                    from: commonData.fromAddress,
                    value: data.delegationsAttachInsurance,
                }
            );
        }
    } else {
        var Item = await compile(
            "../node_modules/@ethereansos/items-v2/contracts/model/Item"
        );
        var item = new web3.eth.Contract(Item.abi, data.collectionAddress);
        var payload = web3.eth.abi.encodeParameters(
            ["address", "address"], [delegation.options.address, utilities.voidEthereumAddress]
        );
        await blockchainCall(
            item.methods.safeTransferFrom,
            commonData.fromAddress,
            data.delegationsManager.options.address,
            data.objectId,
            data.delegationsAttachInsurance,
            payload
        );
    }
}

async function getDFOData(commonData) {

    try {
        await blockchainConnection.unlockAccounts([commonData.ourDFO, commonData.ourSubDAO]);
    } catch(e) {
    }

    var SubDAO = await compile("ext/subDAO/impl/SubDAO");
    var dfo = new web3.eth.Contract(SubDAO.abi, commonData.ourDFO);

    var delegationsManagerAddress = await blockchainCall(
        dfo.methods.get,
        commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER
    );
    var DelegationsManager = await compile(
        "ext/delegationsManager/impl/DelegationsManager"
    );
    var delegationsManager = new web3.eth.Contract(
        DelegationsManager.abi,
        delegationsManagerAddress
    );

    var subDAO = new web3.eth.Contract(SubDAO.abi, commonData.ourSubDAO);
    var stateManagerAddress = await blockchainCall(
        subDAO.methods.get,
        commonData.grimoire.COMPONENT_KEY_STATE_MANAGER
    );
    var StateManager = await compile(
        "base/impl/StateManager"
    );
    var stateManager = new web3.eth.Contract(
        StateManager.abi,
        stateManagerAddress
    );
    var entryValue = await blockchainCall(stateManager.methods.get, 'delegationsAttachInsurance');
    var delegationsAttachInsurance = abi.decode(["uint256"], entryValue.value)[0].toString();

    var attachInsurance = await blockchainCall(delegationsManager.methods.attachInsurance);

    assert.equal(attachInsurance, delegationsAttachInsurance);

    var proposalsManagerAddress = await blockchainCall(
        subDAO.methods.get,
        commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
    );
    var ProposalsManager = await compile(
        "base/impl/ProposalsManager"
    );
    var proposalsManager = new web3.eth.Contract(
        ProposalsManager.abi,
        proposalsManagerAddress
    );

    return {
        dfo,
        collectionAddress : commonData.ITEM_MAININTERFACE,
        objectId : commonData.OS_ID,
        decimals : '18',
        delegationsManager,
        delegationsAttachInsurance,
        subDAO : {
            contract : subDAO,
            proposalsManager,
            stateManager
        }
    };
}

async function checkBalance(commonData, itemMainInterface, data, delegation, transaction, account, value, method, blocksAgo) {
    var receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash || transaction);
    var blockNumber = parseInt(receipt.blockNumber);
    blockNumber = blockNumber - (blocksAgo || 1);
    var balanceBefore = await itemMainInterface.methods.balanceOf(account, data.objectId).call({}, blockNumber);

    var expectedBalance = balanceBefore[method](value);

    var actualBalance = await blockchainCall(itemMainInterface.methods.balanceOf, account, data.objectId);

    assert.equal(expectedBalance, actualBalance);
}

async function wrap(commonData, itemsMainInterface, data, delegation, value, from, to) {

    from = from || accounts[0];
    to = to || utilities.voidEthereumAddress;

    var delegationTokensManagerAddress = await blockchainCall(delegation.methods.get, commonData.grimoire.COMPONENT_KEY_TOKENS_MANAGER);
    var DelegationTokensManager = await compile('ext/delegation/impl/DelegationTokensManager');
    var delegationTokensManager = new web3.eth.Contract(DelegationTokensManager.abi, delegationTokensManagerAddress);

    var delegationTokenData = web3.eth.abi.encodeParameters(
        ["address", "address", "bytes"],
        [
            data.delegationsManager.options.address,
            to,
            "0x"
        ]
    );

    await blockchainCall(itemsMainInterface.methods.safeTransferFrom, from, delegationTokensManager.options.address, data.objectId, value, delegationTokenData, {from : from});

    var wrapped = await blockchainCall(delegationTokensManager.methods.wrapped, data.collectionAddress, data.objectId, data.delegationsManager.options.address);

    return wrapped.wrappedObjectId;
}

async function createOrganization(commonData, collectionAddress, objectId) {
    var decimals;
    if (!collectionAddress) {
        collectionAddress = collectionAddress || utilities.voidEthereumAddress;
    }
    if (objectId === utilities.voidEthereumAddress) {
        decimals = "18";
    } else if (collectionAddress === utilities.voidEthereumAddress) {
        var IERC20 = await compile(
            "../node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata"
        );

        decimals = await blockchainCall(
            new web3.eth.Contract(IERC20.abi, objectId).methods.decimals
        );

        objectId = web3.eth.abi.decodeParameter(
            "uint256",
            web3.eth.abi.encodeParameter("address", objectId)
        );
    } else {
        decimals = "0";
        var Item = await compile(
            "../node_modules/@ethereansos/items-v2/contracts/model/Item"
        );
        try {
            decimals = await blockchainCall(
                new web3.eth.Contract(Item.abi, collectionAddress).methods[
                    "decimals(uint256)"
                ],
                objectId
            );
        } catch (e) {
            try {
                decimals = await blockchainCall(
                    new web3.eth.Contract(Item.abi, collectionAddress).methods[
                        "decimals()"
                    ]
                );
            } catch (e) {}
        }
    }
    var FactoryOfFactories = await compile(
        "ethereans/factoryOfFactories/impl/FactoryOfFactories"
    );
    var factoryOfFactories = new web3.eth.Contract(
        FactoryOfFactories.abi,
        commonData.FACTORY_OF_FACTORIES
    );

    var index = commonData.factoryIndices.dfo;

    var dfoFactory = await blockchainCall(factoryOfFactories.methods.get, index);
    dfoFactory = dfoFactory[1];
    dfoFactory = dfoFactory[dfoFactory.length - 1];

    var DFOFactory = await compile("ethereans/factories/impl/DFOFactory");
    dfoFactory = new web3.eth.Contract(DFOFactory.abi, dfoFactory);

    index = commonData.factoryIndices.delegation;
    var delegationFactoryAddress = await blockchainCall(
        factoryOfFactories.methods.get,
        index
    );
    delegationFactoryAddress = delegationFactoryAddress[1];
    delegationFactoryAddress =
        delegationFactoryAddress[delegationFactoryAddress.length - 1];

    var ProposalModelsFactory = await compile(
        "ethereans/factories/impl/ProposalModelsFactory"
    );
    var proposalModelsFacotry = new web3.eth.Contract(
        ProposalModelsFactory.abi,
        commonData.PROPOSAL_MODELS_FACTORY
    );
    var validator = await getDeployedAddress(
        await blockchainCall(
            proposalModelsFacotry.methods.deploy,
            web3.eth.abi.encodeParameters(
                ["uint256", "bytes"], [
                    3,
                    web3.eth.abi.encodeParameters(
                        ["uint256", "bool"], [utilities.toDecimals("3000", decimals), false]
                    ),
                ]
            ), { from: commonData.from }
        )
    );

    var proposalsManagerConfigurationTypes = [
        "address[]",
        "uint256[]",
        "uint256[]",
        "address",
        "address",
        "address[]",
        "address[]",
    ];

    var proposalsManagerDeployData = abi.encode(
        [`tuple(${proposalsManagerConfigurationTypes.join(",")})`], [
            [
                [collectionAddress || utilities.voidEthereumAddress],
                [objectId],
                [1],
                utilities.voidEthereumAddress,
                utilities.voidEthereumAddress, [terminates],
                [validator],
            ],
        ]
    );

    var delegationsManagerDeployData = web3.eth.abi.encodeParameters(
        ["uint256", "address", "bytes32", "bytes"], [
            utilities.toDecimals(1, decimals),
            utilities.voidEthereumAddress,
            utilities.voidBytes32,
            web3.eth.abi.encodeParameters(
                ["address[]", "address[]"], [
                    [delegationFactoryAddress],
                    []
                ]
            ),
        ]
    );

    delegationsManagerDeployData = web3.eth.abi.encodeParameters(
        ["uint256", "address", "uint256", "bytes"], [
            commonData.executorRewardPercentage,
            collectionAddress || utilities.voidEthereumAddress,
            objectId,
            delegationsManagerDeployData,
        ]
    );

    var organizationDeployDataTypes = [
        "string",
        "bytes[]",
        "uint256[]",
        "bytes[]",
        "bytes[]",
        "bytes",
    ];

    var deployData = abi.encode(
        [`tuple(${organizationDeployDataTypes.join(",")})`], [
            [
                "uri", [proposalsManagerDeployData],
                [6],
                [delegationsManagerDeployData],
                [],
                "0x",
            ],
        ]
    );

    var transaction = await blockchainCall(
        dfoFactory.methods.deploy,
        deployData, { from: commonData.from }
    );
    transaction = await web3.eth.getTransactionReceipt(
        transaction.transactionHash
    );
    var log = transaction.logs.filter(
        (it) =>
        it.topics[0] ===
        web3.utils.sha3("Deployed(address,address,address,bytes)")
    )[0];
    var newDFOAddress = web3.eth.abi.decodeParameter("address", log.topics[2]);

    var SubDAO = await compile("ext/subDAO/impl/SubDAO");
    var dfo = new web3.eth.Contract(SubDAO.abi, newDFOAddress);

    var delegationsManagerAddress = await blockchainCall(
        dfo.methods.get,
        commonData.grimoire.COMPONENT_KEY_DELEGATIONS_MANAGER
    );
    var DelegationsManager = await compile(
        "ext/delegationsManager/impl/DelegationsManager"
    );
    var delegationsManager = new web3.eth.Contract(
        DelegationsManager.abi,
        delegationsManagerAddress
    );

    return {
        dfo,
        collectionAddress,
        objectId,
        decimals,
        delegationsManager,
    };
}

describe("Delegation Vote SubDAO Proposal", () => {
    var commonData;
    var itemMainInterface;

    before(async() => {
        var chainId = parseInt(await web3.eth.net.getId());
        try {
            var dumpPath = path.resolve(__dirname, `../resources/firstProposal/0.5_dump_${chainId}.json`)
            commonData = {...commonData, ...JSON.parse(fs.readFileSync(dumpPath, 'utf-8')), fromAddress : web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY).address, from : process.env.PRIVATE_KEY}
        } catch(e) {}
        try {
            await blockchainConnection.unlockAccounts(commonData.fromAddress);
        } catch(e) {}

        accounts[0] = commonData.fromAddress;

        itemMainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-v2/contracts/model/IItemMainInterface')).abi, commonData.ITEM_MAININTERFACE);

        var ProposalModelsFactory = await compile(
            "ethereans/factories/impl/ProposalModelsFactory"
        );
        var proposalModelsFacotry = new web3.eth.Contract(
            ProposalModelsFactory.abi,
            commonData.PROPOSAL_MODELS_FACTORY
        );
        terminates = await getDeployedAddress(
            await blockchainCall(
                proposalModelsFacotry.methods.deploy,
                web3.eth.abi.encodeParameters(
                    ["uint256", "bytes"], [2, web3.eth.abi.encodeParameter("uint256", 30)]
                ), { from: commonData.from }
            )
        );
    });

    it("Remove & Ban", async () => {

        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        assert.equal(utilities.voidEthereumAddress, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        var transaction = await attach(commonData, data, delegation);
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, accounts[0], data.delegationsAttachInsurance, 'sub', 2);
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, data.delegationsManager.options.address, data.delegationsAttachInsurance, 'add', 2);
        var treasuryManagerOf = await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address);
        assert.notEqual(utilities.voidEthereumAddress, treasuryManagerOf);

        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, utilities.voidEthereumAddress, accounts[2], "0x"), "Delegation");
        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x"), "still attached");

        await catchCall(attach(commonData, data, delegation), "exists");

        assert(!(await blockchainCall(data.delegationsManager.methods.isBanned, delegation.options.address)));
        var exists = await blockchainCall(data.delegationsManager.methods.exists, delegation.options.address);
        assert(exists[0]);
        assert.equal(treasuryManagerOf, exists[2]);

        await catchCall(blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address]), "unauthorized");

        transaction = await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : commonData.ourDFO});
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, accounts[0], '0', 'add');
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, data.delegationsManager.options.address, data.delegationsAttachInsurance, 'sub');

        transaction = await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : commonData.ourDFO});
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, accounts[0], '0', 'add');
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, data.delegationsManager.options.address, '0', 'add');

        await catchCall(blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], data.delegationsManager.options.address, data.objectId, data.delegationsAttachInsurance, "0x"), "ERC1155: transfer to non ERC1155Receiver implementer");

        assert((await blockchainCall(data.delegationsManager.methods.isBanned, delegation.options.address)));
        var exists = await blockchainCall(data.delegationsManager.methods.exists, delegation.options.address);
        assert(!exists[0]);

        assert.equal(treasuryManagerOf, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        assert.equal(treasuryManagerOf, exists[2]);

        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x"), "banned");

        await catchCall(stakeTokens(commonData, data, delegation), "banned");
        await catchCall(attach(commonData, data, delegation), "banned");
        await catchCall(attach(commonData, data, delegation, true), "not valid");

        delegation = await createDelegation(commonData);
        assert.equal(utilities.voidEthereumAddress, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        await attach(commonData, data, delegation);
        treasuryManagerOf = await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address);
        assert.notEqual(utilities.voidEthereumAddress, treasuryManagerOf);

        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, utilities.voidEthereumAddress, accounts[2], "0x"), "Delegation");
        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x"), "still attached");

        assert(!(await blockchainCall(data.delegationsManager.methods.isBanned, delegation.options.address)));
        var exists = await blockchainCall(data.delegationsManager.methods.exists, delegation.options.address);
        assert(exists[0]);
        assert.equal(treasuryManagerOf, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        assert.equal(treasuryManagerOf, exists[2]);

        await catchCall(blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address]), "unauthorized");

        transaction = await blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address], {from : commonData.ourDFO});
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, accounts[0], '0', 'add');
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, data.delegationsManager.options.address, '0', 'add');

        transaction = await blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address], {from : commonData.ourDFO});
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, accounts[0], '0', 'add');
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, data.delegationsManager.options.address, '0', 'add');

        assert(!(await blockchainCall(data.delegationsManager.methods.isBanned, delegation.options.address)));
        var exists = await blockchainCall(data.delegationsManager.methods.exists, delegation.options.address);
        assert(!exists[0]);
        assert.equal(treasuryManagerOf, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        assert.equal(treasuryManagerOf, exists[2]);

        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x", {from : accounts[5]}), "amount");
        await blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x");
        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x"), "amount");

        await attach(commonData, data, delegation);

        assert(!(await blockchainCall(data.delegationsManager.methods.isBanned, delegation.options.address)));
        var exists = await blockchainCall(data.delegationsManager.methods.exists, delegation.options.address);
        assert(exists[0]);
        assert.equal(treasuryManagerOf, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        assert.equal(treasuryManagerOf, exists[2]);

        await blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address], {from : commonData.ourDFO});

        assert(!(await blockchainCall(data.delegationsManager.methods.isBanned, delegation.options.address)));
        var exists = await blockchainCall(data.delegationsManager.methods.exists, delegation.options.address);
        assert(!exists[0]);
        assert.equal(treasuryManagerOf, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        assert.equal(treasuryManagerOf, exists[2]);

        transaction = await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : commonData.ourDFO});
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, accounts[0], '0', 'add');
        await checkBalance(commonData, itemMainInterface, data, delegation, transaction, data.delegationsManager.options.address, data.delegationsAttachInsurance, 'sub');

        assert(await blockchainCall(data.delegationsManager.methods.isBanned, delegation.options.address));
        var exists = await blockchainCall(data.delegationsManager.methods.exists, delegation.options.address);
        assert(!exists[0]);
        assert.equal(treasuryManagerOf, await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address));
        assert.equal(treasuryManagerOf, exists[2]);

        await catchCall(blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x"), "banned");
    });

    it("Vote Deprecated SubDAO Surveyless", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        var wrappedAmount = utilities.numberToString(1e18);

        var args = {
            address : data.subDAO.contract.options.address,
            fromBlock : '0',
            toBlock : 'latest',
            topics : [
                web3.utils.sha3('Proposed(uint256,uint256,bytes32)')
            ]
        };

        var logs = await web3.eth.getPastLogs(args);

        var proposalId = logs[0].topics[3];

        var accept = utilities.numberToString(10 * 1e18);
        var refuse = utilities.numberToString(0);

        accept = wrappedAmount;

        var bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool", "string"], [data.objectId, accept, refuse, true, false, "myUri"]);
        bytecode = web3.eth.abi.encodeParameters(["address", "bytes32", "address", "bytes"], [data.subDAO.proposalsManager.options.address, proposalId, itemMainInterface.options.address, bytecode]);

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }];

        var treasuryManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
        );
        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        await catchCall(blockchainCall(proposalsManager.methods.batchCreate, codes), "wrong address");

        await attach(commonData, data, delegation);

        await catchCall(blockchainCall(proposalsManager.methods.batchCreate, codes), "wrap tokens first");

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        var transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes);

        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var wrappedVote = wrappedAmount;
        wrappedVote = utilities.toDecimals("0.00001", 16).split('.')[0];
        console.log({wrappedVote});

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, false]);

        await catchCall(blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, data.objectId, wrappedVote, payload), "item");

        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        await catchCall(blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true), "termination switch");

        wrappedVote = wrappedAmount.sub(wrappedVote);
        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, false]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        try {
            await catchCall(readProposalTerminated(blockchainCall(proposalsManager.methods.terminate, [delegationProposalId])), "amount exceeds balance");
        } catch(e) {
            if(wrappedAmount !== accept) {
                throw e;
            }
        }

        await blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true);

        await catchCall(readProposalTerminated(blockchainCall(data.subDAO.proposalsManager.methods.terminate, [proposalId])), "deprecated");
        var isPersistentResponse = await blockchainCall(data.subDAO.contract.methods.isPersistent, proposalId)
        assert(isPersistentResponse[0])
        assert(isPersistentResponse[1])

        await catchCall(blockchainCall(data.subDAO.proposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, true), "termination switch");
        await catchCall(blockchainCall(data.subDAO.proposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, false), "No transfers");

        bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool", "string"], [data.objectId, accept, refuse, true, false, "myUri"]);
        bytecode = web3.eth.abi.encodeParameters(["address", "bytes32", "address", "bytes"], [data.subDAO.proposalsManager.options.address, proposalId, itemMainInterface.options.address, bytecode]);

        codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }];

        transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes);
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        wrappedVote = utilities.toDecimals("0.0001", 16);

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, false]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool", "string"], [data.objectId, accept, refuse, false, false, "myUri"]);
        bytecode = web3.eth.abi.encodeParameters(["address", "bytes32", "address", "bytes"], [data.subDAO.proposalsManager.options.address, proposalId, itemMainInterface.options.address, bytecode]);

        codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }];

        transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes);
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, false]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        await blockchainCall(proposalsManager.methods.terminate, [delegationProposalId]);

        await blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true);
    });

    it("Vote Normal SubDAO Proposal", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        var treasuryManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
        );
        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        await attach(commonData, data, delegation);

        var wrappedAmount = utilities.numberToString(1e18);

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        var bytecode = web3.eth.abi.encodeParameters(["string", "address[]"], ["myUri", [commonData.OS_ADDRESS, commonData.OS_ADDRESS, commonData.OS_ADDRESS, commonData.OS_ADDRESS]]);

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [6]))[0],
                bytecode
            }],
            alsoTerminate : false
        }];

        var transaction = await blockchainCall(data.subDAO.proposalsManager.methods.batchCreate, codes);
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var proposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var accept = utilities.numberToString(10 * 1e18);
        var refuse = utilities.numberToString(0);

        accept = wrappedAmount;

        bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool", "string"], [data.objectId, accept, refuse, true, false, "myUri"]);
        bytecode = web3.eth.abi.encodeParameters(["address", "bytes32", "address", "bytes"], [data.subDAO.proposalsManager.options.address, proposalId, itemMainInterface.options.address, bytecode]);

        codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }];

        transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes);
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var wrappedVote = wrappedAmount;

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, false]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        await blockchainCall(proposalsManager.methods.terminate, [delegationProposalId]);

        await blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true);

        await catchCall(blockchainCall(data.subDAO.proposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, true), "termination switch");

        await blockchainConnection.fastForward(200);

        await blockchainCall(data.subDAO.proposalsManager.methods.terminate, [proposalId]);

        await blockchainCall(data.subDAO.proposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, true);
    });

    it("Delegation Vote Changer", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        var treasuryManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
        );
        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        await attach(commonData, data, delegation);

        var wrappedAmount = utilities.numberToString(1e18);

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        var bytecode = web3.eth.abi.encodeParameters(["string", "uint256", "uint256", "uint256", "uint256"], ["myUri", 1, 1, 1, 1]);

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [2]))[0],
                bytecode
            }],
            alsoTerminate : true
        }];

        var oldProposalModels = await blockchainCall(delegation.methods.proposalModels);

        var transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var proposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var proposalModels = await blockchainCall(delegation.methods.proposalModels);

        console.log("old", JSON.stringify(oldProposalModels));
        console.log("new", JSON.stringify(proposalModels));

        var proposalModel = oldProposalModels[oldProposalModels.length - 1];
        var addrs = [];
        proposalModel[proposalModel.length - 1][0].forEach(it => addrs.push(it));
        proposalModel[proposalModel.length - 2][0].forEach(it => addrs.push(it));

        console.log("old", await Promise.all(addrs.map(get)));

        async function get(addr) {
            var Contract = await compile('ext/proposals/ProposalValidators', 'CanBeValidBeforeBlockLength');
            var contract = new web3.eth.Contract(Contract.abi, addr);
            return await blockchainCall(contract.methods.value);
        }

        var proposalModel = proposalModels[proposalModels.length - 1];
        var addrs = [];
        proposalModel[proposalModel.length - 1][0].forEach(it => addrs.push(it));
        proposalModel[proposalModel.length - 2][0].forEach(it => addrs.push(it));

        console.log("new", await Promise.all(addrs.map(get)));
    });

    it("Delegation Transfer ETH", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        var treasuryManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
        );
        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        await attach(commonData, data, delegation);

        var wrappedAmount = utilities.numberToString(1e18);

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        var treasuryManagerOf = await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address);

        var val = utilities.toDecimals(0.5, 18);
        await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : treasuryManagerOf,
            value : val
        }));

        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], treasuryManagerOf, commonData.OS_ID, val.mul(2), "0x");

        var receiver = accounts[9];

        var types = [
            "address",
            "uint256[]",
            "uint256[]",
            "address",
            "bool",
            "bool",
            "bool",
            "bytes"
        ];

        var values = [[
            utilities.voidEthereumAddress,
            [],
            [val],
            receiver,
            false,
            false,
            false,
            "0x"
        ], [
            commonData.OS_ADDRESS,
            [],
            [val],
            accounts[10],
            false,
            false,
            false,
            "0x"
        ], [
            commonData.OS_ADDRESS,
            [],
            [val],
            accounts[11],
            false,
            false,
            false,
            "0x"
        ]]

        var bytecode = abi.encode(["string", "address", `tuple(${types.join(',')})[]`], ["myUri", treasuryManagerOf, values]);

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [3]))[0],
                bytecode,
            }],
            alsoTerminate : false
        }]

        var transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var wrappedVote = wrappedAmount;

        var oldSenderBalance = await web3.eth.getBalance(treasuryManagerOf);
        var oldReceiverBalance = await web3.eth.getBalance(receiver);

        var expectedSenderBalance = oldSenderBalance.sub(val);
        var expectedReceiverBalance = oldReceiverBalance.add(val);

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, true]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        var currentSenderBalance = await web3.eth.getBalance(treasuryManagerOf);
        var currentReceiverBalance = await web3.eth.getBalance(receiver);

        assert.equal(expectedSenderBalance, currentSenderBalance);
        assert.equal(expectedReceiverBalance, currentReceiverBalance);

        await blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true);
    });

    it("Delegation Transfer ERC20", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        var treasuryManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
        );
        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        await attach(commonData, data, delegation);

        var wrappedAmount = utilities.numberToString(1e18);

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        var treasuryManagerOf = await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address);

        var val = utilities.toDecimals(0.5, 18);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], treasuryManagerOf, commonData.OS_ID, val, "0x");

        await web3.eth.sendTransaction(blockchainConnection.getSendingOptions({
            to : treasuryManagerOf,
            value : val.mul(2)
        }));

        var receiver = accounts[9];

        var types = [
            "address",
            "uint256[]",
            "uint256[]",
            "address",
            "bool",
            "bool",
            "bool",
            "bytes"
        ];

        var values = [[
            commonData.OS_ADDRESS,
            [],
            [val],
            receiver,
            false,
            false,
            false,
            "0x"
        ], [
            utilities.voidEthereumAddress,
            [],
            [val],
            accounts[10],
            false,
            false,
            false,
            "0x"
        ], [
            utilities.voidEthereumAddress,
            [],
            [val],
            accounts[11],
            false,
            false,
            false,
            "0x"
        ]]

        var bytecode = abi.encode(["string", "address", `tuple(${types.join(',')})[]`], ["myUri", treasuryManagerOf, values]);

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [3]))[0],
                bytecode,
            }],
            alsoTerminate : false
        }]

        var transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var wrappedVote = wrappedAmount;

        var oldSenderBalance = await blockchainCall(itemMainInterface.methods.balanceOf, treasuryManagerOf, commonData.OS_ID);
        var oldReceiverBalance = await blockchainCall(itemMainInterface.methods.balanceOf, receiver, commonData.OS_ID);

        var expectedSenderBalance = oldSenderBalance.sub(val);
        var expectedReceiverBalance = oldReceiverBalance.add(val);

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, true]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        var currentSenderBalance = await blockchainCall(itemMainInterface.methods.balanceOf, treasuryManagerOf, commonData.OS_ID);
        var currentReceiverBalance = await blockchainCall(itemMainInterface.methods.balanceOf, receiver, commonData.OS_ID);

        assert.equal(expectedSenderBalance, currentSenderBalance);
        assert.equal(expectedReceiverBalance, currentReceiverBalance);

        await blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true);
    });

    it("Delegation vote with ETH and ban burning ETH", async () => {
        var data = await createOrganization(commonData, utilities.voidEthereumAddress, utilities.voidEthereumAddress);
        data.delegationsAttachInsurance = await blockchainCall(data.delegationsManager.methods.attachInsurance);

        var delegation = await createDelegation(commonData);

        var treasuryManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
        );

        await attach(commonData, data, delegation);

        var delegationTokensManagerAddress = await blockchainCall(delegation.methods.get, commonData.grimoire.COMPONENT_KEY_TOKENS_MANAGER);
        var DelegationTokensManager = await compile('ext/delegation/impl/DelegationTokensManager');
        var delegationTokensManager = new web3.eth.Contract(DelegationTokensManager.abi, delegationTokensManagerAddress);

        var wrappedAmount = utilities.toDecimals(0.4, 18);

        await catchCall(blockchainCall(delegationTokensManager.methods.wrap, data.delegationsManager.options.address, "0x", wrappedAmount, utilities.voidEthereumAddress), "ETH");

        var transaction = await blockchainCall(delegationTokensManager.methods.wrap, data.delegationsManager.options.address, "0x", wrappedAmount, utilities.voidEthereumAddress, {value : wrappedAmount});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);

        var log = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('Wrapped(address,uint256,address,uint256)'))[0]
        var wrappedObjectId = web3.eth.abi.decodeParameter("uint256", log.topics[2]);

        var realCode =
        `pragma solidity ^0.8.0;

        contract Contract {

            event Mario();

            function execute(bytes32) external {
                emit Mario();
            }
        }`
        var Contract = await compile(realCode, "Contract");
        var bytecode = new web3.eth.Contract(Contract.abi).deploy({data: Contract.bin}).encodeABI();
        var codes = [{
            codes : [{
                location : utilities.voidEthereumAddress,
                bytecode
            }],
            alsoTerminate : false
        }]

        var dfoProposalsManagerAddress = await blockchainCall(
            data.dfo.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var dfoProposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            dfoProposalsManagerAddress
        );

        transaction = await blockchainCall(dfoProposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var proposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var accept = wrappedAmount;
        var refuse = 0;

        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        var bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool", "string"], ['0', accept, refuse, true, false, "myUri"]);
        bytecode = web3.eth.abi.encodeParameters(["address", "bytes32", "address", "bytes"], [dfoProposalsManagerAddress, proposalId, utilities.voidEthereumAddress, bytecode]);

        codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }];

        transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes);
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var wrappedVote = wrappedAmount;

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, false]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        await blockchainCall(proposalsManager.methods.terminate, [delegationProposalId]);

        await blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true);

        await catchCall(blockchainCall(dfoProposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, true), "termination switch");

        await blockchainConnection.fastForward(200);

        await blockchainCall(dfoProposalsManager.methods.terminate, [proposalId]);

        await catchCall(blockchainCall(dfoProposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, false), "termination switch");

        await blockchainCall(dfoProposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, true);

        await blockchainConnection.unlockAccounts(dfoProposalsManagerAddress);
        await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : dfoProposalsManagerAddress});
    });

    it("Delegation vote with ERC20 ban burning OS (ERC20)", async () => {
        var data = await createOrganization(commonData, utilities.voidEthereumAddress, commonData.OS_ADDRESS);
        data.delegationsAttachInsurance = await blockchainCall(data.delegationsManager.methods.attachInsurance);

        var delegation = await createDelegation(commonData);

        var treasuryManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
        );

        await attach(commonData, data, delegation);

        var delegationTokensManagerAddress = await blockchainCall(delegation.methods.get, commonData.grimoire.COMPONENT_KEY_TOKENS_MANAGER);
        var DelegationTokensManager = await compile('ext/delegation/impl/DelegationTokensManager');
        var delegationTokensManager = new web3.eth.Contract(DelegationTokensManager.abi, delegationTokensManagerAddress);

        var wrappedAmount = utilities.toDecimals(0.4, 18);

        await catchCall(blockchainCall(delegationTokensManager.methods.wrap, data.delegationsManager.options.address, "0x", wrappedAmount, utilities.voidEthereumAddress, {value : wrappedAmount}), "ETH");

        await blockchainCall(itemMainInterface.methods.setApprovalForAll, delegationTokensManager.options.address, true);
        var transaction = await blockchainCall(delegationTokensManager.methods.wrap, data.delegationsManager.options.address, "0x", wrappedAmount, utilities.voidEthereumAddress);
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);

        var log = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('Wrapped(address,uint256,address,uint256)'))[0]
        var wrappedObjectId = web3.eth.abi.decodeParameter("uint256", log.topics[2]);

        var realCode =
        `pragma solidity ^0.8.0;

        contract Contract {

            event Mario();

            function execute(bytes32) external {
                emit Mario();
            }
        }`
        var Contract = await compile(realCode, "Contract");
        var bytecode = new web3.eth.Contract(Contract.abi).deploy({data: Contract.bin}).encodeABI();
        var codes = [{
            codes : [{
                location : utilities.voidEthereumAddress,
                bytecode
            }],
            alsoTerminate : false
        }]

        var dfoProposalsManagerAddress = await blockchainCall(
            data.dfo.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var dfoProposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            dfoProposalsManagerAddress
        );

        transaction = await blockchainCall(dfoProposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var proposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var accept = wrappedAmount;
        var refuse = 0;

        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        var bytecode = web3.eth.abi.encodeParameters(["uint256", "uint256", "uint256", "bool", "bool", "string"], [commonData.OS_ID, accept, refuse, true, false, "myUri"]);
        bytecode = web3.eth.abi.encodeParameters(["address", "bytes32", "address", "bytes"], [dfoProposalsManagerAddress, proposalId, utilities.voidEthereumAddress, bytecode]);

        codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [4]))[0],
                bytecode
            }],
            alsoTerminate : false
        }];

        transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes);
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        delegationProposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        var wrappedVote = wrappedAmount;

        var payload = web3.eth.abi.encodeParameters(["bytes32", "uint256", "uint256", "address", "bool"], [delegationProposalId, wrappedVote, '0', utilities.voidEthereumAddress, false]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], proposalsManagerAddress, wrappedObjectId, wrappedVote, payload);

        await blockchainCall(proposalsManager.methods.terminate, [delegationProposalId]);

        await blockchainCall(proposalsManager.methods.withdrawAll, [delegationProposalId], accounts[0], true);

        await catchCall(blockchainCall(dfoProposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, true), "termination switch");

        await blockchainConnection.fastForward(200);

        await blockchainCall(dfoProposalsManager.methods.terminate, [proposalId]);

        await catchCall(blockchainCall(dfoProposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, false), "termination switch");

        await blockchainCall(dfoProposalsManager.methods.withdrawAll, [proposalId], treasuryManagerAddress, true);

        await blockchainConnection.unlockAccounts(dfoProposalsManagerAddress);
        await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : dfoProposalsManagerAddress});
    });

    it("Attach and ban USDC", async () => {

        var usdcTokenAddress = "0xeb8f08a975ab53e34d8a0330e0d34de942c95926";
        var tokenHolder = "0xbcb1c76eaba4c0f66f22e63e4b651b4125916d77";
        await blockchainConnection.unlockAccounts(tokenHolder);

        var usdcToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            usdcTokenAddress
        );
        var balance = await blockchainCall(usdcToken.methods.balanceOf, tokenHolder);
        await blockchainCall(usdcToken.methods.transfer, accounts[0], balance, {
            from: tokenHolder,
        });

        var data = await createOrganization(commonData, utilities.voidEthereumAddress, usdcTokenAddress);
        data.delegationsAttachInsurance = await blockchainCall(data.delegationsManager.methods.attachInsurance);

        var delegation = await createDelegation(commonData);

        await attach(commonData, data, delegation);

        var dfoProposalsManagerAddress = await blockchainCall(
            data.dfo.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );

        await blockchainConnection.unlockAccounts(dfoProposalsManagerAddress);
        await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : dfoProposalsManagerAddress});

    });

    it("Attach, Remove/Ban, Wrap", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        var wrappedAmount = utilities.toDecimals(0.4, 18);

        await attach(commonData, data, delegation);

        await blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address], {from : commonData.ourDFO});

        await catchCall(wrap(commonData, itemMainInterface, data, delegation, wrappedAmount), "attach");

        await blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x");

        await attach(commonData, data, delegation);

        await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : commonData.ourDFO});

        await catchCall(wrap(commonData, itemMainInterface, data, delegation, wrappedAmount), "attach");
    });

    it("Attach, Wrap, Remove/Ban, Wrap/Unwrap", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);
        var delegationTokensManagerAddress = await blockchainCall(delegation.methods.get, commonData.grimoire.COMPONENT_KEY_TOKENS_MANAGER);

        var wrappedAmount = utilities.toDecimals(0.4, 18);

        await attach(commonData, data, delegation);

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        await blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address], {from : commonData.ourDFO});

        await catchCall(wrap(commonData, itemMainInterface, data, delegation, wrappedAmount), "attach");

        var payload = web3.eth.abi.encodeParameters(["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], delegationTokensManagerAddress, wrappedObjectId, wrappedAmount, payload);

        await blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x");

        await attach(commonData, data, delegation);

        await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : commonData.ourDFO});

        await catchCall(wrap(commonData, itemMainInterface, data, delegation, wrappedAmount), "attach");

        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], delegationTokensManagerAddress, wrappedObjectId, wrappedAmount, payload);
    });

    it("Attach, Remove/Ban, Vote", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);

        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        await attach(commonData, data, delegation);
        await blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address], {from : commonData.ourDFO});
        await blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x");

        var wrappedAmount = utilities.toDecimals(0.4, 18);

        var treasuryManagerOf = await blockchainCall(data.delegationsManager.methods.treasuryOf, delegation.options.address);

        var val = utilities.toDecimals(0.5, 18);

        var receiver = accounts[9];

        var types = [
            "address",
            "uint256[]",
            "uint256[]",
            "address",
            "bool",
            "bool",
            "bool",
            "bytes"
        ];

        var values = [
            commonData.OS_ADDRESS,
            [],
            [val],
            receiver,
            false,
            false,
            false,
            "0x"
        ]

        var bytecode = abi.encode(["string", "address", `tuple(${types.join(',')})[]`], ["myUri", treasuryManagerOf, [values]]);

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [3]))[0],
                bytecode,
            }],
            alsoTerminate : false
        }];

        await catchCall(blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'}), "wrong address");

        await attach(commonData, data, delegation);

        await catchCall(blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'}), "Wrap tokens first");

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        await blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});

        await blockchainCall(data.delegationsManager.methods.remove, [delegation.options.address], {from : commonData.ourDFO});

        await catchCall(blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'}), "wrong address");

        await blockchainCall(data.delegationsManager.methods.retirePayment, delegation.options.address, accounts[2], "0x");

        await attach(commonData, data, delegation);

        await blockchainCall(data.delegationsManager.methods.ban, [delegation.options.address], {from : commonData.ourDFO});

        await catchCall(blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'}), "wrong address");
    });

    it("Proposals change uri and change votes without attach", async () => {
        var delegation = await createDelegation(commonData);

        var proposalsManagerAddress = await blockchainCall(
            delegation.methods.get,
            commonData.grimoire.COMPONENT_KEY_PROPOSALS_MANAGER
        );
        var ProposalsManager = await compile(
            "base/impl/ProposalsManager"
        );
        var proposalsManager = new web3.eth.Contract(
            ProposalsManager.abi,
            proposalsManagerAddress
        );

        var bytecode = abi.encode(["string", "string"], ["myUri", "new uri"]);

        var codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [1]))[0],
                bytecode,
            }],
            alsoTerminate : true
        }];

        var transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        proposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        await catchCall(blockchainCall(proposalsManager.methods.terminate, [proposalId]), "terminated");

        bytecode = web3.eth.abi.encodeParameters(["string", "uint256", "uint256", "uint256", "uint256"], ["myUri", 1, 1, 1, 1]);

        codes = [{
            codes : [{
                location : abi.decode(["address"], abi.encode(["uint256"], [2]))[0],
                bytecode
            }],
            alsoTerminate : true
        }];

        var oldProposalModels = await blockchainCall(delegation.methods.proposalModels);

        transaction = await blockchainCall(proposalsManager.methods.batchCreate, codes, {gasLimit : '6000000'});
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        proposalId = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('ProposalCreated(address,address,bytes32)'))[0].topics[3];

        await catchCall(blockchainCall(proposalsManager.methods.terminate, [proposalId]), "terminated");

        var proposalModels = await blockchainCall(delegation.methods.proposalModels);

        console.log("old", JSON.stringify(oldProposalModels));
        console.log("new", JSON.stringify(proposalModels));
    });

    it("Wrap more people", async () => {
        var data = await getDFOData(commonData);

        var delegation = await createDelegation(commonData);
        var delegationTokensManagerAddress = await blockchainCall(delegation.methods.get, commonData.grimoire.COMPONENT_KEY_TOKENS_MANAGER);

        await attach(commonData, data, delegation);

        var wrappedAmount = utilities.toDecimals(6, 18);

        var wrappedAmount2 = utilities.toDecimals(0.3, 18);

        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], accounts[5], commonData.OS_ID, wrappedAmount2, "0x");

        var wrappedObjectId = await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount);

        await wrap(commonData, itemMainInterface, data, delegation, wrappedAmount2, accounts[5], accounts[3]);

        var wrappedData1 = web3.eth.abi.encodeParameters(["address", "address", "bytes"], [utilities.voidEthereumAddress, accounts[2], "0x"]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[0], delegationTokensManagerAddress, wrappedObjectId, wrappedAmount, wrappedData1);

        var wrappedData2 = web3.eth.abi.encodeParameters(["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]);
        await blockchainCall(itemMainInterface.methods.safeTransferFrom, accounts[3], delegationTokensManagerAddress, wrappedObjectId, wrappedAmount2, wrappedData2, {from : accounts[3]});

    });

    it("Same org, multi del", async () => {
        var data = await getDFOData(commonData);

        var wrappedAmount = utilities.toDecimals(6, 18);

        var delegation1 = await createDelegation(commonData);
        await attach(commonData, data, delegation1);
        var wrap1 = await wrap(commonData, itemMainInterface, data, delegation1, wrappedAmount);

        var delegation2 = await createDelegation(commonData);
        await attach(commonData, data, delegation2);
        var wrap2 = await wrap(commonData, itemMainInterface, data, delegation2, wrappedAmount);

        var delegation3 = await createDelegation(commonData);
        await attach(commonData, data, delegation3);
        var wrap3 = await wrap(commonData, itemMainInterface, data, delegation3, wrappedAmount);

        console.log({
            wrap1,
            wrap2,
            wrap3
        });

        assert.notEqual(wrap1, wrap2);
        assert.notEqual(wrap2, wrap3);
        assert.notEqual(wrap1, wrap3);
    });
});