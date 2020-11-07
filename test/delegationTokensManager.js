const fs = require("fs");
const path = require("path");

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

    var stateEntryTypes = ["string", "bytes32", "bytes"];

    var stateManagerDeployData = abi.encode(
        [`tuple(${stateEntryTypes.join(",")})[]`], [
            [
                [
                    "delegationsAttachInsurance",
                    commonData.grimoire.COMPONENT_KEY_STATE_MANAGER,
                    web3.eth.abi.encodeParameter(
                        "uint256",
                        utilities.toDecimals(1, decimals)
                    ),
                ],
            ],
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

async function attach(commonData, data, delegation) {
    await stakeTokens(commonData, data, delegation);
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
        }, ],
        alsoTerminate: true,
    }, ];
    await blockchainCall(delegationProposalsManager.methods.batchCreate, codes, {
        from: commonData.from,
        gasLimit: "6000000",
    });
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
                utilities.toDecimals(2, data.decimals),
                "0x",
                commonData.fromAddress
            );
        } else {
            await blockchainCall(
                data.delegationsManager.methods.payFor,
                delegation.options.address,
                utilities.toDecimals(2, data.decimals),
                "0x",
                commonData.fromAddress, {
                    from: commonData.fromAddress,
                    value: utilities.toDecimals(2, data.decimals),
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
            utilities.toDecimals(2, data.decimals),
            payload
        );
    }
}

async function createCouple(commonData, tokens) {
    var DelegationTokensManager = await compile(
        "ext/delegation/impl/DelegationTokensManager"
    );
    var TreasuryManager = await compile(
        "base/impl/TreasuryManager"
    );
    var delegation = await createDelegation(commonData);
    var delegationTokensManagerAddress = await blockchainCall(
        delegation.methods.get,
        commonData.grimoire.COMPONENT_KEY_TOKENS_MANAGER
    );
    var delegationTreasuryManagerAddress = await blockchainCall(
        delegation.methods.get,
        commonData.grimoire.COMPONENT_KEY_TREASURY_MANAGER
    );
    delegation = {
        contract: delegation,
        tokensManager: new web3.eth.Contract(
            DelegationTokensManager.abi,
            delegationTokensManagerAddress
        ),
        treasuryManager: new web3.eth.Contract(
            TreasuryManager.abi,
            delegationTreasuryManagerAddress
        ),
        organizations: [],
    };

    for (var token of tokens) {
        var data = await createOrganization(commonData, token.address, token.id);
        await attach(commonData, data, delegation.contract);
        delegation.organizations.push(data);
    }

    return delegation;
}

async function checkSupply(previousSupply, actualSupply) {
    assert.equal(actualSupply, previousSupply);
}

async function checkFromBalance(actualAmount, amount, previousFrom) {
    assert.equal(actualAmount, previousFrom.sub(amount));
}

async function checkToBalance(actualAmount, amount, previousTo) {
    assert.equal(actualAmount, previousTo.add(amount));
}

async function checkBalance(
    fromAmount,
    toAmount,
    amount,
    fromAddress,
    toAddress,
    tokenInstance,
    transaction
) {

    if (transaction) {

        var blockNumber = transaction.blockNumber || (await web3.eth.getTransactionReceipt(transaction.transactionHash || transaction)).blockNumber
        blockNumber = parseInt(blockNumber) - 1

        function balanceOf(token, subject, fromBlock) {
            return token.methods.balanceOf(subject).call({}, fromBlock)
        }

        var fromBefore = await balanceOf(tokenInstance, fromAddress, blockNumber)
        var toBefore = await balanceOf(tokenInstance, fromAddress, blockNumber)

        var fromAfter = await balanceOf(tokenInstance, fromAddress)
        var toAfter = await balanceOf(tokenInstance, fromAddress)

        assert.equal(fromBefore.sub(amount), fromAfter)
        assert.equal(toBefore.add(amount), toAfter)

        return
    }

    assert.equal(
        fromAmount.sub(amount),
        await blockchainCall(tokenInstance.methods.balanceOf, fromAddress)
    );

    assert.equal(
        toAmount.add(amount),
        await blockchainCall(tokenInstance.methods.balanceOf, toAddress)
    );
}

async function check1155Balance(
    fromAmount,
    toAmount,
    amount,
    tokenId,
    fromAddress,
    toAddress,
    tokenInstance
) {
    assert.equal(
        fromAmount.sub(amount),
        await blockchainCall(tokenInstance.methods.balanceOf, fromAddress, tokenId)
    );

    assert.equal(
        toAmount.add(amount),
        await blockchainCall(tokenInstance.methods.balanceOf, toAddress, tokenId)
    );
}

async function checkWrappedItemBalance(amount, to, itemId, tokenInstance) {
    assert.equal(
        amount,
        await blockchainCall(tokenInstance.methods.balanceOf, to, itemId)
    );
}

async function checkDecimals(wrappedInstance) {
    assert.equal("18", await blockchainCall(wrappedInstance.methods.decimals));
}

describe("Delegation Tokens Manager", () => {
    var commonData;
    var itemMainInterface;

    before(async() => {
        try {
            var dumpPath = path.resolve(
                __dirname,
                "../resources/firstProposal/0.5_dump.json"
            );
            commonData = {
                ...commonData,
                ...JSON.parse(fs.readFileSync(dumpPath, "utf-8")),
            };
        } catch (e) {}
        try {
            await blockchainConnection.unlockAccounts(commonData.fromAddress);
        } catch (e) {}

        accounts[0] = commonData.fromAddress;

        itemMainInterface = new web3.eth.Contract(
            (
                await compile(
                    "../node_modules/@ethereansos/items-v2/contracts/model/IItemMainInterface"
                )
            ).abi,
            commonData.ITEM_MAININTERFACE
        );

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

        var tokenHolderOs = "0x34aaa7c97830c206c42916185bb5e850d8a6b916";
        await blockchainConnection.unlockAccounts(tokenHolderOs)
        var tokenHolderUsdc = "0xbcb1c76eaba4c0f66f22e63e4b651b4125916d77";
        await blockchainConnection.unlockAccounts(tokenHolderUsdc);
        var tokenHolderZerion = "0xb3f292f9f7f4ae7472c1e7c0f1b14fb13bd3b12b";
        await blockchainConnection.unlockAccounts(tokenHolderZerion);
        var tokenHolderRarible = "0xebe38b545198578975571096717fb3377647deae";
        await blockchainConnection.unlockAccounts(tokenHolderRarible);
        var tokenHolderUni = "0x11e4857bb9993a50c685a79afad4e6f65d518dda";
        await blockchainConnection.unlockAccounts(tokenHolderUni);
        var tokenHolderRarible2 = "0xf9cc7c350ce727ceb84e4c0a95a00eabe88c09e4";
        await blockchainConnection.unlockAccounts(tokenHolderRarible2);
        var tokenHolderZerion2 = "0xd8282a355383a6513eccc8a16f990ba0026c2d1a";
        await blockchainConnection.unlockAccounts(tokenHolderZerion2);
    });

    it("ERC20 test - UNI", async() => {
        /**
         * Must fail: a wrapping operation passing a wrong Delegation Manager address, cannot be performed.
         * Must fail: a wrapping operation passing address(0) as Delegation Manager address, cannot be performed.
         * Wrap UNI (18 decimals) passing an accounts receiver address
         * Unwrap UNI
         */
        var tokenHolder = "0x11e4857bb9993a50c685a79afad4e6f65d518dda";

        var tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";

        var uniToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            tokenAddress
        );
        var balance = await blockchainCall(uniToken.methods.balanceOf, tokenHolder);
        await blockchainCall(uniToken.methods.transfer, accounts[0], balance, {
            from: tokenHolder,
        });
        var tokens = [{
            address: utilities.voidEthereumAddress,
            id: tokenAddress,
        }, ];
        var delegation = await createCouple(commonData, tokens);

        var DelegationTokensManager = delegation.tokensManager;

        await blockchainCall(
            uniToken.methods.transfer,
            accounts[1],
            await blockchainCall(uniToken.methods.balanceOf, accounts[0]), { from: accounts[0] }
        );

        var wrongDelegationManager = "0x7f11cadb05454bee700a22197c2714d7f1465e51";

        await catchCall(
            blockchainCall(
                DelegationTokensManager.methods.wrap,
                wrongDelegationManager,
                "0x",
                (
                    await blockchainCall(uniToken.methods.balanceOf, accounts[0])
                ).div(3.4),
                accounts[2], { from: accounts[1] }
            ),
            ""
        );

        wrongDelegationManager = utilities.voidEthereumAddress;

        await catchCall(
            blockchainCall(
                DelegationTokensManager.methods.wrap,
                wrongDelegationManager,
                "0x",
                (
                    await blockchainCall(uniToken.methods.balanceOf, accounts[0])
                ).div(3.4),
                accounts[2], { from: accounts[1] }
            ),
            "Delegations Manager"
        );

        var sourceDelegationsManagerAddress =
            delegation.organizations[0].delegationsManager.options.address;

        await blockchainCall(
            uniToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(uniToken.methods.balanceOf, accounts[1]), { from: accounts[1] }
        );

        var amountToWrap = (
            await blockchainCall(uniToken.methods.balanceOf, accounts[1])
        ).div(3.5);

        var tokenTotalSupply = await blockchainCall(uniToken.methods.totalSupply);

        var previousBalanceFrom = await blockchainCall(
            uniToken.methods.balanceOf,
            accounts[1]
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddress,
            "0x",
            amountToWrap,
            accounts[3], { from: accounts[1] }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var source = await blockchainCall(DelegationTokensManager.methods.source, itemId);
        assert.equal(source[0], utilities.voidEthereumAddress);
        assert.equal(source[1], web3.utils.toBN(tokenAddress).toString());
        assert.equal(source[2], sourceDelegationsManagerAddress);
        console.log(source)

        var wrapped = await blockchainCall(DelegationTokensManager.methods.wrapped, utilities.voidEthereumAddress, web3.eth.abi.encodeParameter('uint256', tokenAddress), sourceDelegationsManagerAddress);
        assert.equal(wrapped[0], itemMainInterface.options.address);
        assert.equal(wrapped[1], itemId);
        console.log(wrapped)

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        assert.equal(delegation.treasuryManager.options.address, treasuryManager)

        var previousTreasuryBalanceFrom = await blockchainCall(
            uniToken.methods.balanceOf,
            treasuryManager
        );

        var itemTotalSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId
        );

        await checkBalance(
            previousBalanceFrom,
            previousTreasuryBalanceFrom.sub(amountToWrap),
            amountToWrap,
            accounts[1],
            treasuryManager,
            uniToken
        );

        await checkWrappedItemBalance(
            amountToWrap,
            accounts[3],
            itemId,
            itemMainInterface
        );

        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(uniToken.methods.totalSupply)
        );

        await checkSupply(
            amountToWrap,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        var previousBalanceFrom = await blockchainCall(
            uniToken.methods.balanceOf,
            accounts[3]
        );

        var previousTreasuryBalanceFrom = await blockchainCall(
            uniToken.methods.balanceOf,
            treasuryManager
        );

        var amountToUnwrap = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[3],
            itemId
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[3],
            DelegationTokensManager.options.address,
            itemId,
            amountToUnwrap,
            encodeUnwrap, { from: accounts[3] }
        );

        await checkBalance(
            previousTreasuryBalanceFrom,
            previousBalanceFrom,
            amountToUnwrap,
            treasuryManager,
            accounts[3],
            uniToken
        );

        await checkSupply(
            itemTotalSupply.sub(amountToWrap),
            await blockchainCall(itemMainInterface.methods.totalSupply, 0)
        );
        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(uniToken.methods.totalSupply)
        );
    });

    it("ERC20 test - USDC", async() => {
        /**
         * Must fail: a wrapping operation passing amount 0, cannot be performed.
            Wrap USDC (6 decimals) x2
            Unwrap USDC x2 passing an accounts receiver address
         */
        var tokenHolder = "0xbcb1c76eaba4c0f66f22e63e4b651b4125916d77";

        var usdcToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            "0xeb8f08a975ab53e34d8a0330e0d34de942c95926"
        );
        var balance = "345353535353552383";
        await blockchainCall(usdcToken.methods.transfer, accounts[0], balance, {
            from: tokenHolder,
        });
        await blockchainCall(
            usdcToken.methods.transfer,
            accounts[2],
            balance.div(3.5), { from: accounts[0] }
        );
        await blockchainCall(
            usdcToken.methods.transfer,
            accounts[3],
            balance.div(2.6), { from: accounts[0] }
        );
        var tokens = [{
            address: utilities.voidEthereumAddress,
            id: usdcToken.options.address,
        }, ];
        var delegation = await createCouple(commonData, tokens);

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddress =
            delegation.organizations[0].delegationsManager.options.address;

        await blockchainCall(
            usdcToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(usdcToken.methods.balanceOf, accounts[2]), { from: accounts[2] }
        );

        var amountToWrap = await blockchainCall(
            usdcToken.methods.balanceOf,
            accounts[2]
        );

        var tokenTotalSupply = await blockchainCall(usdcToken.methods.totalSupply);

        var previousBalanceFrom = await blockchainCall(
            usdcToken.methods.balanceOf,
            accounts[2]
        );

        var previousBalanceFrom3 = await blockchainCall(
            usdcToken.methods.balanceOf,
            accounts[3]
        );

        await catchCall(
            blockchainCall(
                DelegationTokensManager.methods.wrap,
                sourceDelegationsManagerAddress,
                "0x",
                0,
                utilities.voidEthereumAddress, { from: accounts[2] }
            ),
            ""
        );

        await catchCall(
            blockchainCall(
                DelegationTokensManager.methods.wrap,
                sourceDelegationsManagerAddress,
                "0x",
                amountToWrap,
                utilities.voidEthereumAddress, { from: accounts[2], value: "1000000000000000000" }
            ), "ETH"
        );

        var treasuryManager = delegation.treasuryManager.options.address;

        var previousTreasuryBalanceFrom = await blockchainCall(
            usdcToken.methods.balanceOf,
            treasuryManager
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddress,
            "0x",
            amountToWrap,
            utilities.voidEthereumAddress, { from: accounts[2] }
        );

        await checkBalance(
            previousBalanceFrom,
            previousTreasuryBalanceFrom,
            amountToWrap,
            accounts[1],
            treasuryManager,
            usdcToken
        );

        await blockchainCall(
            usdcToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(usdcToken.methods.balanceOf, accounts[3]), { from: accounts[3] }
        );

        var amountToWrap3 = await blockchainCall(
            usdcToken.methods.balanceOf,
            accounts[3]
        );

        previousTreasuryBalanceFrom = await blockchainCall(
            usdcToken.methods.balanceOf,
            treasuryManager
        );

        var wrap3 = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddress,
            "0x",
            amountToWrap3,
            utilities.voidEthereumAddress, { from: accounts[3] }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        assert.equal(delegation.treasuryManager.options.address, treasuryManager)

        await checkBalance(
            previousBalanceFrom3,
            previousTreasuryBalanceFrom,
            amountToWrap3,
            accounts[3],
            treasuryManager,
            usdcToken
        );

        await checkWrappedItemBalance(
            utilities.normalizeValue(amountToWrap, 6),
            accounts[2],
            itemId,
            itemMainInterface
        );

        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(usdcToken.methods.totalSupply)
        );

        await checkFromBalance(
            await blockchainCall(usdcToken.methods.balanceOf, accounts[3]),
            amountToWrap3,
            previousBalanceFrom3
        );

        await checkWrappedItemBalance(
            utilities.normalizeValue(amountToWrap3, 6),
            accounts[3],
            itemId,
            itemMainInterface
        );

        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(usdcToken.methods.totalSupply)
        );

        await checkSupply(
            utilities.normalizeValue(amountToWrap.add(amountToWrap3), 6),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        var itemTotalSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId
        );

        var itemBalance3 = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[3],
            itemId
        );

        var previousTreasuryBalanceFrom = await blockchainCall(
            usdcToken.methods.balanceOf,
            treasuryManager
        );

        var previousBalanceFrom = await blockchainCall(
            usdcToken.methods.balanceOf,
            accounts[1]
        );

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, accounts[1], "0x"]
        );

        var amountToUnwrap = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[2],
            itemId
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[2],
            DelegationTokensManager.options.address,
            itemId,
            amountToUnwrap,
            encodeWrap, { from: accounts[2] }
        );

        await checkBalance(
            previousTreasuryBalanceFrom,
            previousBalanceFrom,
            amountToUnwrap.div(1e12),
            treasuryManager,
            accounts[1],
            usdcToken
        );

        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(usdcToken.methods.totalSupply)
        );

        var amountToUnwrap3 = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[3],
            itemId
        );

        var accountsToBalance3 = await blockchainCall(
            usdcToken.methods.balanceOf,
            accounts[1]
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[3],
            DelegationTokensManager.options.address,
            itemId,
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[3],
                itemId
            ),
            encodeWrap, { from: accounts[3] }
        );

        await checkFromBalance(
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[3],
                itemId
            ),
            amountToUnwrap3,
            itemBalance3
        );

        await checkToBalance(
            await blockchainCall(usdcToken.methods.balanceOf, accounts[1]),
            amountToWrap3,
            accountsToBalance3
        );
        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(usdcToken.methods.totalSupply)
        );

        await checkSupply(
            itemTotalSupply.sub(amountToUnwrap).sub(amountToUnwrap3),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );
    });

    it("ERC20 test - DEFL, ETH and OS (Int. Interface)", async() => {
        /**
         * Wrap DEFL (deflationary token with 0 decimals)  passing an accounts receiver address
          Wrap OS (18 decimals)
          Wrap ETH
          Unwrap DDEFL  passing an accounts receiver address
          Unwrap DOS
          Unwrap DETH
         */
        var tokenHolderOs = "0x34aaa7c97830c206c42916185bb5e850d8a6b916";
        var tokenHolderDefl = "0x34aaa7C97830c206c42916185BB5e850D8a6B916";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            "0x20276BA44228370f18cD7a036a4bca1473B8b557"
        );
        var balance = await blockchainCall(
            osToken.methods.balanceOf,
            tokenHolderOs
        );

        await blockchainCall(osToken.methods.transfer, accounts[0], 100, {
            from: tokenHolderOs,
        });

        var deflToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            "0x729ecb1680e9e7b5d5f4c6e783c2c2d5079d7c7b"
        );
        var balance = await blockchainCall(
            deflToken.methods.balanceOf,
            tokenHolderDefl
        );

        await blockchainCall(deflToken.methods.transfer, accounts[0], 200, {
            from: tokenHolderDefl,
        });

        await blockchainCall(
            deflToken.methods.transfer,
            accounts[0],
            await blockchainCall(deflToken.methods.balanceOf, tokenHolderDefl), {
                from: tokenHolderDefl,
            }
        );

        await blockchainCall(
            osToken.methods.transfer,
            accounts[4],
            balance.sub(100), {
                from: tokenHolderOs,
            }
        );

        var deflToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            "0x729ecb1680e9e7b5d5f4c6e783c2c2d5079d7c7b"
        );
        var balance = await blockchainCall(
            deflToken.methods.balanceOf,
            tokenHolderDefl
        );

        await blockchainCall(deflToken.methods.transfer, accounts[0], balance, {
            from: tokenHolderDefl,
        });

        var tokens = [{
                //eth
                address: utilities.voidEthereumAddress,
                id: utilities.voidEthereumAddress,
            },
            {
                //os
                address: utilities.voidEthereumAddress,
                id: "0x20276BA44228370f18cD7a036a4bca1473B8b557",
            },
            {
                //defl
                address: utilities.voidEthereumAddress,
                id: "0x729ecb1680e9e7b5d5f4c6e783c2c2d5079d7c7b",
            },
        ];

        var delegation = await createCouple(commonData, tokens);

        await blockchainCall(
            deflToken.methods.transfer,
            accounts[3],
            await blockchainCall(deflToken.methods.balanceOf, accounts[0])
        );

        await blockchainCall(
            osToken.methods.transfer,
            accounts[4],
            await blockchainCall(osToken.methods.balanceOf, accounts[0])
        );

        var DelegationTokensManager = delegation.tokensManager;

        // OS wrap
        var sourceDelegationsManagerAddressOs =
            delegation.organizations[1].delegationsManager.options.address;

        await blockchainCall(
            osToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(osToken.methods.balanceOf, accounts[4]), { from: accounts[4] }
        );

        var amountToWrapOs = (
            await blockchainCall(osToken.methods.balanceOf, accounts[4])
        ).div(3.9);

        var tokenTotalSupply = await blockchainCall(osToken.methods.totalSupply);

        var previousBalanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[4]
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressOs,
            "0x",
            amountToWrapOs,
            utilities.voidEthereumAddress, { from: accounts[4] }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdOs = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        assert.equal(delegation.treasuryManager.options.address, treasuryManager)

        var previousTreasuryBalanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager
        );

        var itemTotalSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdOs
        );

        var itemBalance = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[4],
            itemIdOs
        );

        var accountsToBalance = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[4]
        );

        await checkBalance(
            previousBalanceFrom,
            previousTreasuryBalanceFrom.sub(amountToWrapOs),
            amountToWrapOs,
            accounts[4],
            treasuryManager,
            osToken
        );

        await checkWrappedItemBalance(
            amountToWrapOs,
            accounts[4],
            itemIdOs,
            itemMainInterface
        );

        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(osToken.methods.totalSupply)
        );

        await checkSupply(
            amountToWrapOs,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdOs)
        );

        // END OS wrap

        // DEFL wrap
        var sourceDelegationsManagerAddressDefl =
            delegation.organizations[2].delegationsManager.options.address;

        await blockchainCall(
            deflToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(deflToken.methods.balanceOf, accounts[3]), { from: accounts[3] }
        );

        var deflTotalSupply = await blockchainCall(deflToken.methods.totalSupply);

        var amountToWrap = await blockchainCall(
            deflToken.methods.balanceOf,
            accounts[3]
        );

        var fromAmountDefl = await blockchainCall(
            deflToken.methods.balanceOf,
            accounts[3]
        );

        var prevBalance = await blockchainCall(
            deflToken.methods.balanceOf,
            treasuryManager,
        );

        var previousBalanceFrom = await blockchainCall(
            deflToken.methods.balanceOf,
            accounts[3]
        );

        var previousTreasuryBalanceFrom = await blockchainCall(
            deflToken.methods.balanceOf,
            treasuryManager
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressDefl,
            "0x",
            amountToWrap.div(3.9),
            accounts[1], { from: accounts[3] }
        );

        var postBalace = await blockchainCall(
            deflToken.methods.balanceOf,
            treasuryManager,
        );

        var sentAmount = postBalace.sub(prevBalance);
        var burntAmount = amountToWrap.div(3.9).sub(sentAmount);

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdDefl = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        await checkWrappedItemBalance(
            utilities.normalizeValue(sentAmount, 0),
            accounts[1],
            itemIdDefl,
            itemMainInterface
        );

        await checkFromBalance(
            await blockchainCall(deflToken.methods.balanceOf, accounts[3]),
            amountToWrap.div(3.9),
            fromAmountDefl
        );

        assert.equal(postBalace, (prevBalance.add((amountToWrap.div(3.9)).sub(burntAmount))));

        await checkSupply(
            utilities.normalizeValue(sentAmount, 0),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdDefl)
        );

        await checkSupply(
            deflTotalSupply.sub(burntAmount),
            await blockchainCall(deflToken.methods.totalSupply)
        );

        // END DEFL wrap

        // ETH wrap
        var sourceDelegationsManagerAddressEth =
            delegation.organizations[0].delegationsManager.options.address;

        var amountToWrapEth = 100;

        var previousBalanceFromEth = await web3.eth.getBalance(accounts[5]);

        var previousBalanceToEth = await web3.eth.getBalance(treasuryManager);

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressEth,
            "0x",
            utilities.toDecimals(amountToWrapEth, 18),
            utilities.voidEthereumAddress, { from: accounts[5], value: utilities.toDecimals(amountToWrapEth, 18) }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdEth = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        assert.equal(
            await web3.eth.getBalance(accounts[5]),
            previousBalanceFromEth
            .sub(await blockchainConnection.calculateTransactionFee(wrap))
            .sub(utilities.toDecimals(amountToWrapEth, 18))
        );

        assert.equal(
            await web3.eth.getBalance(treasuryManager),
            previousBalanceToEth
            .add(utilities.toDecimals(amountToWrapEth, 18))
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[5],
            itemIdEth,
            itemMainInterface
        );

        await checkSupply(
            utilities.toDecimals(amountToWrapEth, 18),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth)
        );
        // END ETH wrap

        // DEFL unwrap
        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var amountToUnwrap = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[1],
            itemIdDefl
        );

        var prevSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdDefl
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[1],
            DelegationTokensManager.options.address,
            itemIdDefl,
            amountToUnwrap,
            encodeWrap, { from: accounts[1] }
        );

        await checkSupply(
            prevSupply.sub(amountToUnwrap),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdDefl)
        )

        assert.equal(
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[1],
                itemIdDefl
            ),
            "0"
        );
        // END DEFL unwrap

        //os unwrap
        var previousTreasuryBalanceFrom = await blockchainCall(osToken.methods.balanceOf, treasuryManager);

        var previousBalanceFrom = await blockchainCall(osToken.methods.balanceOf, accounts[4]);

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[4],
            DelegationTokensManager.options.address,
            itemIdOs,
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[4],
                itemIdOs
            ),
            encodeWrap, { from: accounts[4] }
        );

        await checkFromBalance(
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdOs),
            amountToWrapOs,
            itemBalance
        );

        await checkToBalance(
            await blockchainCall(osToken.methods.balanceOf, accounts[4]),
            amountToWrapOs,
            accountsToBalance
        );

        await checkBalance(
            previousTreasuryBalanceFrom,
            previousBalanceFrom,
            amountToWrapOs,
            treasuryManager,
            accounts[4],
            osToken
        );

        await checkSupply(
            itemTotalSupply.sub(amountToWrapOs),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdOs)
        );
        await checkSupply(
            tokenTotalSupply,
            await blockchainCall(osToken.methods.totalSupply)
        );
        //END os unwrap

        // ETH unwrap
        previousBalanceFromEth = await web3.eth.getBalance(accounts[5]);
        previousBalanceToEth = await web3.eth.getBalance(treasuryManager);

        var itemBalanceEth = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[5],
            itemIdEth
        );

        var itemTotalSupplyEth = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdEth
        );

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[5],
            DelegationTokensManager.options.address,
            itemIdEth,
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[5],
                itemIdEth
            ),
            encodeWrap, { from: accounts[5] }
        );

        assert.equal(
            await web3.eth.getBalance(accounts[5]),
            previousBalanceFromEth.add(
                utilities
                .toDecimals(amountToWrapEth, 18)
                .sub(await blockchainConnection.calculateTransactionFee(tx))
            )
        );

        await checkFromBalance(
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth),
            utilities.toDecimals(amountToWrapEth, 18),
            itemBalanceEth
        );

        await checkSupply(
            itemTotalSupplyEth.sub(utilities.toDecimals(amountToWrapEth, 18)),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth)
        );
        // END ETH unwrap
    });





    it("ERC1155 test - OS (Main Int.), OS(Main Int.) and AMD", async() => {
        /**
         * Wrap AMD (0 decimals) passing an accounts receiver address
          Batch Wrap OS and OS (18 decimals) of two different Organizations
          Must fail: an unwrapping operation passing an amount lower than 1e18 (51e16) , cannot be performed.
          Must fail: an unwrapping operation passing an amount lower than 1e18 (2e17) , cannot be performed.
          Batch Unwrap DOS, DOS and AMD of three different Organizations
         */
        var tokenHolderOs = "0xdf9e73d45324f20e8bb19f59e8221f9227157b21";
        var tokenHolderAMD = "0x413bbfd677038a80c60db645d2aa64b12ce998b4";
        await blockchainConnection.unlockAccounts(tokenHolderOs);


        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var tokenAddressAMD = "0x474aba21846bf2862946c63bdff6e479d03455a2";
        var tokenIdAMD = "1";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        var amdToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressAMD
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, tokenHolderOs, tokenIdOs),
            utilities.voidBytes32, { from: tokenHolderOs }
        );

        await blockchainCall(
            amdToken.methods.safeTransferFrom,
            tokenHolderAMD,
            commonData.fromAddress,
            tokenIdAMD,
            await blockchainCall(
                amdToken.methods.balanceOf,
                tokenHolderAMD,
                tokenIdAMD
            ),
            utilities.voidBytes32, { from: tokenHolderAMD }
        );

        var tokens = [{
                address: tokenAddressOs,
                id: tokenIdOs,
            },
            {
                address: tokenAddressOs,
                id: tokenIdOs,
            },
            {
                address: tokenAddressAMD,
                id: tokenIdAMD,
            },
        ];
        var delegation = await createCouple(commonData, tokens);

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[0],
            accounts[6],
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, accounts[0], tokenIdOs),
            utilities.voidBytes32, { from: accounts[0] }
        );

        await blockchainCall(
            amdToken.methods.safeTransferFrom,
            accounts[0],
            accounts[7],
            tokenIdAMD,
            await blockchainCall(amdToken.methods.balanceOf, accounts[0], tokenIdAMD),
            utilities.voidBytes32, { from: accounts[0] }
        );

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddressOs1 =
            delegation.organizations[0].delegationsManager.options.address;

        var sourceDelegationsManagerAddressOs2 =
            delegation.organizations[1].delegationsManager.options.address;

        var sourceDelegationsManagerAddressAMD =
            delegation.organizations[2].delegationsManager.options.address;

        var balanceFromAmd = await blockchainCall(
            amdToken.methods.balanceOf,
            accounts[7],
            tokenIdAMD
        );

        var amountToWrap = 1;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddressAMD, accounts[1], "0x"]
        );

        var tx = await blockchainCall(
            amdToken.methods.safeTransferFrom,
            accounts[7],
            DelegationTokensManager.options.address,
            tokenIdAMD,
            amountToWrap,
            encodeWrap, { from: accounts[7] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var itemIdAmd = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3(
                    "TransferSingle(address,address,address,uint256,uint256)"
                )
            )[1].topics[3]
        );

        assert.equal(delegation.treasuryManager.options.address, treasuryManager)

        var balanceTo = await blockchainCall(
            amdToken.methods.balanceOf,
            treasuryManager,
            tokenIdAMD
        );

        await check1155Balance(
            balanceFromAmd,
            balanceTo.sub(amountToWrap),
            amountToWrap,
            tokenIdAMD,
            accounts[7],
            treasuryManager,
            amdToken
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrap, 18),
            accounts[1],
            itemIdAmd,
            itemMainInterface
        );

        await checkSupply(
            utilities.toDecimals(amountToWrap, 18),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdAmd)
        );

        var encoded = [];

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddressOs1, utilities.voidEthereumAddress, "0x"]
        );

        var encodeWrap2 = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddressOs2, accounts[7], "0x"]
        );

        encoded.push(encodeWrap);
        encoded.push(encodeWrap2);

        var datas = web3.eth.abi.encodeParameters(["bytes[]"], [encoded]);

        var osBalanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var osSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var amountToWrap1 = (
            await blockchainCall(osToken.methods.balanceOf, accounts[6], tokenIdOs)
        ).div(2.4);

        var amountToWrap2 = (
            await blockchainCall(osToken.methods.balanceOf, accounts[6], tokenIdOs)
        ).div(3.5);

        var tx = await blockchainCall(
            osToken.methods.safeBatchTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address, [tokenIdOs, tokenIdOs], [amountToWrap1, amountToWrap2],
            datas, { from: accounts[6] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var itemId2 = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[1].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3(
                    "TransferSingle(address,address,address,uint256,uint256)"
                )
            )[1].topics[3]
        );

        var os1BalanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            itemId
        );

        var os2BalanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            itemId2
        );

        await check1155Balance(
            osBalanceFrom.sub(amountToWrap2),
            os1BalanceTo.add(amountToWrap2),
            amountToWrap1,
            tokenIdOs,
            accounts[6],
            treasuryManager,
            osToken
        );

        await check1155Balance(
            osBalanceFrom.sub(amountToWrap1),
            os2BalanceTo.add(amountToWrap1),
            amountToWrap2,
            tokenIdOs,
            accounts[6],
            treasuryManager,
            osToken
        );

        await checkWrappedItemBalance(
            amountToWrap1,
            accounts[6],
            itemId,
            itemMainInterface
        );

        await checkWrappedItemBalance(
            amountToWrap2,
            accounts[7],
            itemId2,
            itemMainInterface
        );

        await checkSupply(
            osSupply,
            await blockchainCall(itemMainInterface.methods.totalSupply, tokenIdOs)
        );

        await checkSupply(
            amountToWrap1,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        await checkSupply(
            amountToWrap2,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId2)
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[7],
            accounts[6],
            itemId2,
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[7],
                itemId2
            ),
            utilities.voidBytes32, { from: accounts[7] }
        );

        var osBalanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            tokenIdOs
        );

        var osBalanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var delegationOs1BalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemId
        );

        var delegationOs2BalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemId2
        );

        var osSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var delegationOs1Supply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId
        );

        var delegationOs2Supply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId2
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[1],
            accounts[6],
            itemIdAmd,
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[1],
                itemIdAmd
            ),
            utilities.voidBytes32, { from: accounts[1] }
        );


        var encodeUnwrapAmd = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, accounts[7], "0x"]
        );

        await catchCall(
            blockchainCall(
                itemMainInterface.methods.safeTransferFrom,
                accounts[6],
                DelegationTokensManager.options.address,
                itemIdAmd,
                "510000000000000000",
                encodeUnwrapAmd, { from: accounts[6] }
            ),
            "non-consistent value"
        );

        await catchCall(
            blockchainCall(
                itemMainInterface.methods.safeTransferFrom,
                accounts[6],
                DelegationTokensManager.options.address,
                itemIdAmd,
                "200000000000000000",
                encodeUnwrapAmd, { from: accounts[6] }
            ),
            "non-consistent value"
        );

        var balanceFromAmd = await blockchainCall(
            amdToken.methods.balanceOf,
            treasuryManager,
            tokenIdAMD
        );

        var balanceToAmd = await blockchainCall(
            amdToken.methods.balanceOf,
            accounts[7],
            tokenIdAMD
        );

        var delegationBalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdAmd
        );

        var delegationSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdAmd
        );

        var amountToUnwrapAmd = "1000000000000000000";

        var encodeUnwrapList = [];

        encodeUnwrapList.push(encodeUnwrap);
        encodeUnwrapList.push(encodeUnwrap);
        encodeUnwrapList.push(encodeUnwrapAmd);

        var datas = web3.eth.abi.encodeParameters(["bytes[]"], [encodeUnwrapList]);

        var amountToUnwrap = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemId
        );

        await blockchainCall(
            itemMainInterface.methods.safeBatchTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address, [itemId, itemId2, itemIdAmd], [amountToUnwrap.div(2.4), amountToUnwrap.div(3.5), amountToUnwrapAmd],
            datas, { from: accounts[6] }
        );

        await check1155Balance(
            osBalanceFrom,
            osBalanceTo,
            amountToUnwrap.div(2.4).add(amountToUnwrap.div(3.5)),
            tokenIdOs,
            treasuryManager,
            accounts[6],
            osToken
        );

        assert.equal(
            delegationOs1BalanceFrom.sub(amountToUnwrap.div(2.4)),
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[6],
                itemId
            )
        );

        assert.equal(
            delegationOs2BalanceFrom.sub(amountToUnwrap.div(3.5)),
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[6],
                itemId2
            )
        );

        await checkSupply(
            delegationOs1Supply.sub(amountToUnwrap.div(2.4)),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        await checkSupply(
            delegationOs2Supply.sub(amountToUnwrap.div(3.5)),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId2)
        );

        await checkSupply(
            osSupply,
            await blockchainCall(itemMainInterface.methods.totalSupply, tokenIdOs)
        );

        await check1155Balance(
            balanceFromAmd,
            balanceToAmd,
            1,
            tokenIdAMD,
            treasuryManager,
            accounts[7],
            amdToken
        );

        assert.equal(
            delegationBalanceFrom.sub(amountToUnwrapAmd),
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[6],
                itemIdAmd
            )
        );

        await checkSupply(
            delegationSupply.sub(amountToUnwrapAmd),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdAmd)
        );
    });

    it("ERC1155 test - Zerion Genesis Collection", async() => {
        /**
         * Must fail: a wrapping operation passing a wrong Delegation Manager address, cannot be performed.
          Wrap ZCG (0 decimals) passing an accounts receiver address
          Must fail: an unwrapping operation passing an amount lower than 1e18 (6e17) , cannot be performed.
          Must fail: an unwrapping operation passing an amount lower than 1e18 (4e17) , cannot be performed.
          Unwrap DZCG passing an accounts receiver address
         */
        var tokenHolder = "0xb3f292f9f7f4ae7472c1e7c0f1b14fb13bd3b12b";

        var tokenAddress = "0x35573543f290fef43d62ad3269bb9a733445ddab";
        var tokenId = 4;

        var zerionToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddress
        );

        await blockchainCall(
            zerionToken.methods.safeTransferFrom,
            tokenHolder,
            commonData.fromAddress,
            tokenId,
            await blockchainCall(zerionToken.methods.balanceOf, tokenHolder, tokenId),
            utilities.voidBytes32, { from: tokenHolder }
        );

        var tokens = [{
            address: tokenAddress,
            id: tokenId,
        }, ];
        var delegation = await createCouple(commonData, tokens);

        await blockchainCall(
            zerionToken.methods.safeTransferFrom,
            accounts[0],
            accounts[5],
            tokenId,
            await blockchainCall(zerionToken.methods.balanceOf, accounts[0], tokenId),
            utilities.voidBytes32, { from: accounts[0] }
        );

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddress =
            delegation.organizations[0].delegationsManager.options.address;

        var wrongDelegationManager = itemMainInterface.options.address;

        var wrongEncode = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [wrongDelegationManager, accounts[1], "0x"]
        );

        await catchCall(
            blockchainCall(
                zerionToken.methods.safeTransferFrom,
                accounts[5],
                DelegationTokensManager.options.address,
                tokenId,
                1,
                wrongEncode, { from: accounts[5] }
            ),
            "ERC1155: transfer to non ERC1155Receiver implementer"
        );

        var zerionBalanceFrom = await blockchainCall(
            zerionToken.methods.balanceOf,
            accounts[5],
            tokenId
        );

        var amountToWrap = 1;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddress, accounts[2], "0x"]
        );

        var tx = await blockchainCall(
            zerionToken.methods.safeTransferFrom,
            accounts[5],
            DelegationTokensManager.options.address,
            tokenId,
            amountToWrap,
            encodeWrap, { from: accounts[5] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3(
                    "TransferSingle(address,address,address,uint256,uint256)"
                )
            )[1].topics[3]
        );

        assert.equal(delegation.treasuryManager.options.address, treasuryManager)

        var zerionBalanceTo = await blockchainCall(
            zerionToken.methods.balanceOf,
            treasuryManager,
            tokenId
        );

        await check1155Balance(
            zerionBalanceFrom,
            zerionBalanceTo.sub(amountToWrap),
            amountToWrap,
            tokenId,
            accounts[5],
            treasuryManager,
            zerionToken
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrap, 18),
            accounts[2],
            itemId,
            itemMainInterface
        );

        await checkSupply(
            utilities.toDecimals(amountToWrap, 18),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        var amountToUnwrap = "600000000000000000";

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await catchCall(
            blockchainCall(
                itemMainInterface.methods.safeTransferFrom,
                accounts[2],
                DelegationTokensManager.options.address,
                itemId,
                amountToUnwrap,
                encodeUnwrap, { from: accounts[2] }
            ),
            "non-consistent value"
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await catchCall(
            blockchainCall(
                itemMainInterface.methods.safeTransferFrom,
                accounts[2],
                DelegationTokensManager.options.address,
                itemId,
                "400000000000000000",
                encodeUnwrap, { from: accounts[2] }
            ),
            "non-consistent value"
        );

        var zerionBalanceFrom = await blockchainCall(
            zerionToken.methods.balanceOf,
            treasuryManager,
            tokenId
        );

        var zerionBalanceTo = await blockchainCall(
            zerionToken.methods.balanceOf,
            accounts[3],
            tokenId
        );

        var delegationZerionBalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[2],
            itemId
        );

        var zerionSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenId
        );

        var delegationZerionSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId
        );

        var amountToUnwrap = "1000000000000000000";

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, accounts[3], "0x"]
        );

        var tx = await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[2],
            DelegationTokensManager.options.address,
            itemId,
            "1000000000000000000",
            encodeUnwrap, { from: accounts[2] }
        );

        await check1155Balance(
            zerionBalanceFrom,
            zerionBalanceTo,
            1,
            tokenId,
            treasuryManager,
            accounts[3],
            zerionToken
        );

        assert.equal(
            delegationZerionBalanceFrom.sub(amountToUnwrap),
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[2],
                itemId
            )
        );

        await checkSupply(
            delegationZerionSupply.sub(amountToUnwrap),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );
    });

    it("ERC1155 test - Rarible", async() => {
        /**
         * Wrap RBR (0 decimals)
          Must fail: an unwrapping operation passing 2.5e17, cannot be performed.
          Unwrap DRBR
          Wrap RBR
         */
        var tokenHolder = "0xebe38b545198578975571096717fb3377647deae";

        var tokenAddress = "0x1b04ef4f3e47dc40b48f0292c381074631166fdf";
        var tokenId = "36";

        var raribleToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddress
        );
        await blockchainCall(
            raribleToken.methods.safeTransferFrom,
            tokenHolder,
            commonData.fromAddress,
            tokenId,
            await blockchainCall(
                raribleToken.methods.balanceOf,
                tokenHolder,
                tokenId
            ),
            utilities.voidBytes32, { from: tokenHolder }
        );

        var tokens = [{
            address: tokenAddress,
            id: tokenId,
        }, ];
        var delegation = await createCouple(commonData, tokens);

        await blockchainCall(
            raribleToken.methods.safeTransferFrom,
            accounts[0],
            accounts[8],
            tokenId,
            await blockchainCall(
                raribleToken.methods.balanceOf,
                accounts[0],
                tokenId
            ),
            utilities.voidBytes32, { from: accounts[0] }
        );

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddress =
            delegation.organizations[0].delegationsManager.options.address;

        var balanceFrom = await blockchainCall(
            raribleToken.methods.balanceOf,
            accounts[8],
            tokenId
        );

        var amountToWrap = 6;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await blockchainCall(
            raribleToken.methods.safeTransferFrom,
            accounts[8],
            DelegationTokensManager.options.address,
            tokenId,
            amountToWrap,
            encodeWrap, { from: accounts[8] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3(
                    "TransferSingle(address,address,address,uint256,uint256)"
                )
            )[1].topics[3]
        );

        assert.equal(delegation.treasuryManager.options.address, treasuryManager)

        var source = await blockchainCall(DelegationTokensManager.methods.source, itemId);
        console.log(source)
        assert.equal(source[0].toLowerCase(), tokenAddress.toLowerCase());
        assert.equal(source[1], tokenId);
        assert.equal(source[2], sourceDelegationsManagerAddress);

        var wrapped = await blockchainCall(DelegationTokensManager.methods.wrapped, tokenAddress, tokenId, sourceDelegationsManagerAddress);
        console.log(wrapped)
        assert.equal(wrapped[0], itemMainInterface.options.address);
        assert.equal(wrapped[1], itemId);

        var balanceTo = await blockchainCall(
            raribleToken.methods.balanceOf,
            treasuryManager,
            tokenId
        );

        await check1155Balance(
            balanceFrom,
            balanceTo.sub(amountToWrap),
            amountToWrap,
            tokenId,
            accounts[8],
            treasuryManager,
            raribleToken
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrap, 18),
            accounts[8],
            itemId,
            itemMainInterface
        );

        await checkSupply(
            utilities.toDecimals(amountToWrap, 18),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[8],
            accounts[2],
            itemId,
            "3500000000000000000",
            encodeWrap, { from: accounts[8] }
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await catchCall(
            blockchainCall(
                itemMainInterface.methods.safeTransferFrom,
                accounts[8],
                DelegationTokensManager.options.address,
                itemId,
                "2500000000000000000",
                encodeUnwrap, { from: accounts[8] }
            ),
            "non-consistent value"
        );

        var balanceFrom = await blockchainCall(
            raribleToken.methods.balanceOf,
            treasuryManager,
            tokenId
        );

        var balanceTo = await blockchainCall(
            raribleToken.methods.balanceOf,
            accounts[2],
            tokenId
        );

        var delegationBalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[2],
            itemId
        );

        var delegationSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId
        );

        var amountToUnwrap = "2000000000000000000";

        var tx = await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[2],
            DelegationTokensManager.options.address,
            itemId,
            amountToUnwrap,
            encodeUnwrap, { from: accounts[2] }
        );

        await check1155Balance(
            balanceFrom,
            balanceTo,
            2,
            tokenId,
            treasuryManager,
            accounts[2],
            raribleToken
        );

        assert.equal(
            delegationBalanceFrom.sub(amountToUnwrap),
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[2],
                itemId
            )
        );

        await checkSupply(
            delegationSupply.sub(amountToUnwrap),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        var balanceFrom = await blockchainCall(
            raribleToken.methods.balanceOf,
            accounts[2],
            tokenId
        );

        var delegationSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId
        );

        var balanceTo = await blockchainCall(
            raribleToken.methods.balanceOf,
            treasuryManager,
            tokenId
        );

        var previousBalanceTo = await blockchainCall(itemMainInterface.methods.balanceOf, accounts[2], itemId)

        var amountToWrap = 2;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddress, utilities.voidEthereumAddress, "0x"]
        );

        await blockchainCall(
            raribleToken.methods.safeTransferFrom,
            accounts[2],
            DelegationTokensManager.options.address,
            tokenId,
            amountToWrap,
            encodeWrap, { from: accounts[2] }
        );

        await check1155Balance(
            balanceFrom,
            balanceTo,
            amountToWrap,
            tokenId,
            accounts[2],
            treasuryManager,
            raribleToken
        );

        await checkWrappedItemBalance(
            previousBalanceTo.add(utilities.toDecimals(amountToWrap, 18)),
            accounts[2],
            itemId,
            itemMainInterface
        );

        await checkSupply(
            delegationSupply.add(utilities.toDecimals(amountToWrap, 18)),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

    });

    it("ERC1155 test - OS (Main Int.) and ETH", async() => {
        /**
         * Wrap OS (18 decimals)
          Wrap ETH passing an accounts receiver address
          Unwrap part of DOS amount passing an accounts receiver address
          Unwrap remaining DOS amount passing an accounts receiver address
          Wrap OS
          Unwrap DETH passing an accounts receiver address
          Wrap ETH passing an accounts receiver address
         */
        var tokenHolderOs = "0xdf9e73d45324f20e8bb19f59e8221f9227157b21";

        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, tokenHolderOs, tokenIdOs),
            utilities.voidBytes32, { from: tokenHolderOs }
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[4],
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, accounts[4], tokenIdOs),
            utilities.voidBytes32, { from: accounts[4] }
        );

        var tokens = [{
                address: tokenAddressOs,
                id: tokenIdOs,
            },
            {
                //eth
                address: utilities.voidEthereumAddress,
                id: utilities.voidEthereumAddress,
            },
        ];

        var delegation = await createCouple(commonData, tokens);

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[0],
            accounts[6],
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, accounts[0], tokenIdOs),
            utilities.voidBytes32, { from: accounts[0] }
        );

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddressOs =
            delegation.organizations[0].delegationsManager.options.address;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddressOs, utilities.voidEthereumAddress, "0x"]
        );

        var balanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var supplyOs = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var osAmountToWrap = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var tx = await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            tokenIdOs,
            osAmountToWrap,
            encodeWrap, { from: accounts[6] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var itemIdOs = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3(
                    "TransferSingle(address,address,address,uint256,uint256)"
                )
            )[1].topics[3]
        );

        assert.equal(delegation.treasuryManager.options.address, treasuryManager)

        var source = await blockchainCall(DelegationTokensManager.methods.source, itemIdOs);
        assert.equal(source[0].toLowerCase(), tokenAddressOs.toLowerCase());
        assert.equal(source[1], tokenIdOs);
        assert.equal(source[2], sourceDelegationsManagerAddressOs);
        console.log(source)
        var wrapped = await blockchainCall(DelegationTokensManager.methods.wrapped, tokenAddressOs, tokenIdOs, sourceDelegationsManagerAddressOs);
        assert.equal(wrapped[0], itemMainInterface.options.address);
        assert.equal(wrapped[1], itemIdOs);
        console.log(wrapped)
        var balanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            tokenIdOs
        );

        await check1155Balance(
            balanceFrom,
            balanceTo.sub(osAmountToWrap),
            osAmountToWrap,
            tokenIdOs,
            accounts[6],
            treasuryManager,
            osToken
        );

        await checkWrappedItemBalance(
            osAmountToWrap,
            accounts[6],
            itemIdOs,
            itemMainInterface
        );

        await checkSupply(
            supplyOs,
            await blockchainCall(itemMainInterface.methods.totalSupply, tokenIdOs)
        );

        await checkSupply(
            osAmountToWrap,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdOs)
        );

        // END Wrap OS

        // WRAP ETH

        var sourceDelegationsManagerAddressEth =
            delegation.organizations[1].delegationsManager.options.address;

        var amountToWrapEth = 0.49498794;

        var previousBalanceFromEth = await web3.eth.getBalance(accounts[5]);

        var previousBalanceToEth = await web3.eth.getBalance(treasuryManager);

        var wrongWrap1 = await catchCall(
            blockchainCall(
                DelegationTokensManager.methods.wrap,
                sourceDelegationsManagerAddressEth,
                "0x",
                utilities.toDecimals(amountToWrapEth, 18),
                accounts[6], { from: accounts[5], value: (utilities.toDecimals(amountToWrapEth, 18)).div(2) }
            ), "eth");

        var wrongWrap2 = await catchCall(
            blockchainCall(
                DelegationTokensManager.methods.wrap,
                sourceDelegationsManagerAddressEth,
                "0x",
                utilities.toDecimals(amountToWrapEth, 18),
                accounts[6], { from: accounts[5], value: (utilities.toDecimals(amountToWrapEth, 18)).mul(2) }
            ), "eth");

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressEth,
            "0x",
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[6], { from: accounts[5], value: utilities.toDecimals(amountToWrapEth, 18) }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdEth = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManagerEth = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        var source = await blockchainCall(DelegationTokensManager.methods.source, itemIdEth);
        assert.equal(source[0], utilities.voidEthereumAddress);
        assert.equal(source[1], "0");
        assert.equal(source[2], sourceDelegationsManagerAddressEth);
        console.log(source)

        var wrapped = await blockchainCall(DelegationTokensManager.methods.wrapped, utilities.voidEthereumAddress, web3.eth.abi.encodeParameter('uint256', utilities.voidEthereumAddress), sourceDelegationsManagerAddressEth);
        assert.equal(wrapped[0], itemMainInterface.options.address);
        assert.equal(wrapped[1], itemIdEth);
        console.log(wrapped)

        assert.equal(
            await web3.eth.getBalance(accounts[5]),
            previousBalanceFromEth
            .sub(await blockchainConnection.calculateTransactionFee(wrongWrap1))
            .sub(await blockchainConnection.calculateTransactionFee(wrongWrap2))
            .sub(await blockchainConnection.calculateTransactionFee(wrap))
            .sub(utilities.toDecimals(amountToWrapEth, 18))
        );

        assert.equal(
            await web3.eth.getBalance(treasuryManager),
            previousBalanceToEth.add(utilities.toDecimals(amountToWrapEth, 18))
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[6],
            itemIdEth,
            itemMainInterface
        );

        await checkSupply(
            utilities.toDecimals(amountToWrapEth, 18),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth)
        );

        // END Wrap ETH

        var balanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            tokenIdOs
        );

        var balanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var delegationBalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdOs
        );

        var supplyOs = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var delegationSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdOs
        );

        var amountToUnwrap = osAmountToWrap.div(2);

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            itemIdOs,
            amountToUnwrap,
            encodeUnwrap, { from: accounts[6] }
        );

        await check1155Balance(
            balanceFrom,
            balanceTo,
            amountToUnwrap,
            tokenIdOs,
            treasuryManager,
            accounts[6],
            osToken
        );

        assert.equal(
            delegationBalanceFrom.sub(amountToUnwrap),
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[6],
                itemIdOs
            )
        );

        await checkSupply(
            delegationSupply.sub(amountToUnwrap),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdOs)
        );

        await checkSupply(
            supplyOs,
            await blockchainCall(itemMainInterface.methods.totalSupply, tokenIdOs)
        );

        var balanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            tokenIdOs
        );

        var balanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var delegationBalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdOs
        );

        var supply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var delegationSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdOs
        );


        var amountToUnwrap = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdOs
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            itemIdOs,
            amountToUnwrap,
            encodeUnwrap, { from: accounts[6] }
        );

        assert.equal(await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdOs
        ), "0");

        var balanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var supplyOs = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var os2AmountToWrap = osAmountToWrap.div(3);

        var balanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            tokenIdOs
        );

        var delegationBalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdOs
        );

        var tx = await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            tokenIdOs,
            osAmountToWrap.div(3),
            encodeWrap, { from: accounts[6] }
        );

        await check1155Balance(
            balanceFrom,
            balanceTo,
            os2AmountToWrap,
            tokenIdOs,
            accounts[6],
            treasuryManager,
            osToken
        );

        assert.equal(
            delegationBalanceFrom.add(os2AmountToWrap),
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[6],
                itemIdOs
            )
        );

        await checkSupply(
            supplyOs,
            await blockchainCall(itemMainInterface.methods.totalSupply, tokenIdOs)
        );

        await checkSupply(
            os2AmountToWrap,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdOs)
        );

        //  Unwrap eth

        previousBalanceFromEth = await web3.eth.getBalance(accounts[6]);
        previousBalanceToEth = await web3.eth.getBalance(treasuryManager);

        var itemBalanceEth = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdEth
        );

        var itemTotalSupplyEth = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdEth
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var amountToUnwrapEth = 0.1549848;

        var tx = await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            itemIdEth,
            utilities.toDecimals(amountToUnwrapEth, 18),
            encodeUnwrap, { from: accounts[6] }
        );

        assert.equal(
            await web3.eth.getBalance(accounts[6]),
            previousBalanceFromEth.add(
                utilities
                .toDecimals(amountToUnwrapEth, 18)
                .sub(await blockchainConnection.calculateTransactionFee(tx))
            )
        );

        assert.equal(
            await web3.eth.getBalance(treasuryManager),
            previousBalanceToEth.sub(utilities.toDecimals(amountToUnwrapEth, 18))
        );

        await checkFromBalance(
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth),
            utilities.toDecimals(amountToUnwrapEth, 18),
            itemBalanceEth
        );

        await checkSupply(
            itemTotalSupplyEth.sub(utilities.toDecimals(amountToUnwrapEth, 18)),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth)
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var amountToUnwrapEth = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdEth
        )

        var tx = await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            itemIdEth,
            amountToUnwrapEth,
            encodeUnwrap, { from: accounts[6] }
        );

        assert.equal(await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdEth
        ), "0")

        // end unwrap eth
        // Wrap eth

        var amountToWrapEth = 0.2798721;

        var itemTotalSupplyEth = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdEth
        );

        var previousBalanceFromEth = await web3.eth.getBalance(accounts[6]);

        var previousBalanceToEth = await web3.eth.getBalance(treasuryManager);

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressEth,
            "0x",
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[7], { from: accounts[6], value: utilities.toDecimals(amountToWrapEth, 18) }
        );

        assert.equal(
            await web3.eth.getBalance(accounts[6]),
            previousBalanceFromEth
            .sub(await blockchainConnection.calculateTransactionFee(wrap))
            .sub(utilities.toDecimals(amountToWrapEth, 18))
        );

        assert.equal(
            await web3.eth.getBalance(treasuryManager),
            previousBalanceToEth.add(utilities.toDecimals(amountToWrapEth, 18))
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[7],
            itemIdEth,
            itemMainInterface
        );

        await checkSupply(
            itemTotalSupplyEth.add(utilities.toDecimals(amountToWrapEth, 18)),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth)
        );
    });

    it("test Unwrap must fail scenario: ETH - OS (Main Int.)", async() => {
        /**
         * Wrap ETH passing an accounts receiver address
           Must fail: an unwrapping operation passing OS (Main Int.) with amount equals to the previously ETH wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount lower than the previously ETH wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount higher than the previously ETH wrapped amount cannot be performed.
         */

        var tokenHolderOs = "0x3e9a213cb971f0c681b5b5ff74d138750092da59";

        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            accounts[0],
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, tokenHolderOs, tokenIdOs),
            utilities.voidBytes32, { from: tokenHolderOs }
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[7],
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, accounts[4], tokenIdOs),
            utilities.voidBytes32, { from: accounts[7] }
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[6],
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, accounts[4], tokenIdOs),
            utilities.voidBytes32, { from: accounts[6] }
        );

        var tokens = [{
            //eth
            address: utilities.voidEthereumAddress,
            id: utilities.voidEthereumAddress,
        }, ];

        var delegation = await createCouple(commonData, tokens);
        var DelegationTokensManager = delegation.tokensManager;


        var sourceDelegationsManagerAddressEth =
            delegation.organizations[0].delegationsManager.options.address;

        var amountToWrapEth = 0.49498794;

        var previousBalanceFromEth = await web3.eth.getBalance(accounts[5]);

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressEth,
            "0x",
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[0], { from: accounts[5], value: utilities.toDecimals(amountToWrapEth, 18) }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdEth = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManagerEth = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        var source = await blockchainCall(DelegationTokensManager.methods.source, itemIdEth);
        assert.equal(source[0], utilities.voidEthereumAddress);
        assert.equal(source[1], "0");
        assert.equal(source[2], sourceDelegationsManagerAddressEth);
        console.log(source)

        var wrapped = await blockchainCall(DelegationTokensManager.methods.wrapped, utilities.voidEthereumAddress, web3.eth.abi.encodeParameter('uint256', utilities.voidEthereumAddress), sourceDelegationsManagerAddressEth);
        assert.equal(wrapped[0], itemMainInterface.options.address);
        assert.equal(wrapped[1], itemIdEth);
        console.log(wrapped)

        assert.equal(
            await web3.eth.getBalance(accounts[5]),
            previousBalanceFromEth
            .sub(await blockchainConnection.calculateTransactionFee(wrap))
            .sub(utilities.toDecimals(amountToWrapEth, 18))
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[0],
            itemIdEth,
            itemMainInterface
        );

        await checkSupply(
            utilities.toDecimals(amountToWrapEth, 18),
            await blockchainCall(itemMainInterface.methods.totalSupply, itemIdEth)
        );

        // END Wrap ETH

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            utilities.toDecimals(amountToWrapEth, 18),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            (utilities.toDecimals(amountToWrapEth, 18)).div(2),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            (utilities.toDecimals(amountToWrapEth, 18)).mul(2),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

    })

    it("test Unwrap must fail scenario: USDC - OS (Main Int.)", async() => {
        /**
         * Wrap USDC passing an accounts receiver address
           Must fail: an unwrapping operation passing OS (Main Int.) with amount equals to the previously USDC wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount lower than the previously USDC wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount higher than the previously USDC wrapped amount cannot be performed.
         */

        var tokenHolderOs = "0x3e9a213cb971f0c681b5b5ff74d138750092da59";

        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, tokenHolderOs, tokenIdOs),
            utilities.voidBytes32, { from: tokenHolderOs }
        );

        var tokenHolder = "0xbcb1c76eaba4c0f66f22e63e4b651b4125916d77";

        var usdcToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            "0xeb8f08a975ab53e34d8a0330e0d34de942c95926"
        );
        var balance = "345353535353552383";
        await blockchainCall(usdcToken.methods.transfer, accounts[0], balance, {
            from: tokenHolder,
        });
        await blockchainCall(
            usdcToken.methods.transfer,
            accounts[2],
            balance.div(3.5), { from: accounts[0] }
        );
        await blockchainCall(
            usdcToken.methods.transfer,
            accounts[3],
            balance.div(2.6), { from: accounts[0] }
        );
        var tokens = [{
            address: utilities.voidEthereumAddress,
            id: usdcToken.options.address,
        }, ];
        var delegation = await createCouple(commonData, tokens);

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddress =
            delegation.organizations[0].delegationsManager.options.address;

        await blockchainCall(
            usdcToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(usdcToken.methods.balanceOf, accounts[2]), { from: accounts[2] }
        );

        var amountToWrap = await blockchainCall(
            usdcToken.methods.balanceOf,
            accounts[2]
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddress,
            "0x",
            amountToWrap,
            utilities.voidEthereumAddress, { from: accounts[2] }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] === web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            amountToWrap,
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            amountToWrap.div(2),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");


        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            amountToWrap.mul(2),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");
    });


    it("test Unwrap must fail scenario: Zerion - OS (Main Int.)", async() => {
        /**
         * Wrap Zerion (1155 with 0 decimals) passing an accounts receiver address
           Must fail: an unwrapping operation passing OS (Main Int.) with amount equals to the previously Zerion wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount lower than the previously Zerion wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount higher than the previously Zerion wrapped amount cannot be performed.
         */

        var tokenHolderOs = "0xd8282a355383a6513eccc8a16f990ba0026c2d1a";

        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, tokenHolderOs, tokenIdOs),
            utilities.voidBytes32, { from: tokenHolderOs }
        );

        var tokenHolder = "0x203477162865dd22488a60e3e478e7795af95052";

        var tokenAddress = "0x35573543f290fef43d62ad3269bb9a733445ddab";
        var tokenId = 5;

        var zerionToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddress
        );

        await blockchainCall(
            zerionToken.methods.safeTransferFrom,
            accounts[3],
            commonData.fromAddress,
            tokenId,
            await blockchainCall(zerionToken.methods.balanceOf, accounts[3], tokenId),
            utilities.voidBytes32, { from: accounts[3] }
        );

        await blockchainCall(
            zerionToken.methods.safeTransferFrom,
            tokenHolder,
            commonData.fromAddress,
            tokenId,
            await blockchainCall(zerionToken.methods.balanceOf, tokenHolder, tokenId),
            utilities.voidBytes32, { from: tokenHolder }
        );

        var tokens = [{
            address: tokenAddress,
            id: tokenId,
        }, ];

        var delegation = await createCouple(commonData, tokens);

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddress =
            delegation.organizations[0].delegationsManager.options.address;

        var amountToWrap = 1;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddress, accounts[2], "0x"]
        );

        var tx = await blockchainCall(
            zerionToken.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenId,
            amountToWrap,
            encodeWrap, { from: accounts[0] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3(
                    "TransferSingle(address,address,address,uint256,uint256)"
                )
            )[1].topics[3]
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            utilities.toDecimals(amountToWrap, 6),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            (utilities.toDecimals(amountToWrap, 6)).div(2),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            (utilities.toDecimals(amountToWrap, 6)).mul(2),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

    });

    it("test Unwrap must fail scenario: Rarible - OS (Main Int.)", async() => {
        /**
         * Wrap Rarible (1155 with 0 decimals) passing an accounts receiver address
           Must fail: an unwrapping operation passing OS (Main Int.) with amount equals to the previously Rarible wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount lower than the previously Rarible wrapped amount cannot be performed.
           Must fail: an unwrapping operation passing OS (Main Int.) with amount higher than the previously Rarible wrapped amount cannot be performed.
         */

        var tokenHolderOs = "0xd8282a355383a6513eccc8a16f990ba0026c2d1a";

        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(osToken.methods.balanceOf, tokenHolderOs, tokenIdOs),
            utilities.voidBytes32, { from: tokenHolderOs }
        );

        var tokenHolder = "0xf9cc7c350ce727ceb84e4c0a95a00eabe88c09e4";

        var tokenAddress = "0x1b04ef4f3e47dc40b48f0292c381074631166fdf";
        var tokenId = "58";

        var raribleToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddress
        );
        await blockchainCall(
            raribleToken.methods.safeTransferFrom,
            tokenHolder,
            commonData.fromAddress,
            tokenId,
            await blockchainCall(
                raribleToken.methods.balanceOf,
                tokenHolder,
                tokenId
            ),
            utilities.voidBytes32, { from: tokenHolder }
        );

        var tokens = [{
            address: tokenAddress,
            id: tokenId,
        }, ];

        var delegation = await createCouple(commonData, tokens);

        await blockchainCall(
            raribleToken.methods.safeTransferFrom,
            accounts[0],
            accounts[8],
            tokenId,
            await blockchainCall(
                raribleToken.methods.balanceOf,
                accounts[0],
                tokenId
            ),
            utilities.voidBytes32, { from: accounts[0] }
        );

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddress =
            delegation.organizations[0].delegationsManager.options.address;

        var balanceFrom = await blockchainCall(
            raribleToken.methods.balanceOf,
            accounts[8],
            tokenId
        );

        var amountToWrap = 2;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [sourceDelegationsManagerAddress, utilities.voidEthereumAddress, "0x"]
        );

        var tx = await blockchainCall(
            raribleToken.methods.safeTransferFrom,
            accounts[8],
            DelegationTokensManager.options.address,
            tokenId,
            amountToWrap,
            encodeWrap, { from: accounts[8] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash)).logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                it.topics[0] ===
                web3.utils.sha3(
                    "TransferSingle(address,address,address,uint256,uint256)"
                )
            )[1].topics[3]
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"], [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        var sourceData = await blockchainCall(DelegationTokensManager.methods.source, tokenIdOs);
        console.log({sourceData});
        assert.equal(utilities.voidEthereumAddress, sourceData[0]);
        assert.equal("0", sourceData[1]);
        assert.equal(utilities.voidEthereumAddress, sourceData[2]);

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            utilities.toDecimals(amountToWrap, 6),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            (utilities.toDecimals(amountToWrap, 6)).div(2),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

        await catchCall(blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[0],
            DelegationTokensManager.options.address,
            tokenIdOs,
            (utilities.toDecimals(amountToWrap, 6)).add(1),
            encodeUnwrap, { from: accounts[0] }
        ), "unknown");

    });

    it("ERC1155 test - OS (Main Int.), OS(Main Int.) and AMD #2", async () => {
        /**
     * Wrap AMD (0 decimals) passing an accounts receiver address
      Batch Wrap OS and OS (18 decimals) of two different Organizations
      Must fail: an unwrapping operation passing an amount lower than 1e18 (51e16) , cannot be performed.
      Must fail: an unwrapping operation passing an amount lower than 1e18 (2e17) , cannot be performed.
      Batch Unwrap of DOS, DOS and AMD of three different Organizations and wrap of OS in the same safeBatchTransferFrom transaction
     */
        var tokenHolderOs = "0xdf9e73d45324f20e8bb19f59e8221f9227157b21";
        var tokenHolderAMD = "0x413bbfd677038a80c60db645d2aa64b12ce998b4";
        await blockchainConnection.unlockAccounts(tokenHolderOs);

        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var tokenAddressAMD = "0x474aba21846bf2862946c63bdff6e479d03455a2";
        var tokenIdAMD = "1";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        var amdToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressAMD
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(
                osToken.methods.balanceOf,
                tokenHolderOs,
                tokenIdOs
            ),
            utilities.voidBytes32,
            { from: tokenHolderOs }
        );

        await blockchainCall(
            amdToken.methods.safeTransferFrom,
            tokenHolderAMD,
            commonData.fromAddress,
            tokenIdAMD,
            await blockchainCall(
                amdToken.methods.balanceOf,
                tokenHolderAMD,
                tokenIdAMD
            ),
            utilities.voidBytes32,
            { from: tokenHolderAMD }
        );

        var tokens = [
            {
                address: tokenAddressOs,
                id: tokenIdOs,
            },
            {
                address: tokenAddressOs,
                id: tokenIdOs,
            },
            {
                address: tokenAddressAMD,
                id: tokenIdAMD,
            },
        ];
        var delegation = await createCouple(commonData, tokens);

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[0],
            accounts[6],
            tokenIdOs,
            await blockchainCall(
                osToken.methods.balanceOf,
                accounts[0],
                tokenIdOs
            ),
            utilities.voidBytes32,
            { from: accounts[0] }
        );

        await blockchainCall(
            amdToken.methods.safeTransferFrom,
            accounts[0],
            accounts[7],
            tokenIdAMD,
            await blockchainCall(
                amdToken.methods.balanceOf,
                accounts[0],
                tokenIdAMD
            ),
            utilities.voidBytes32,
            { from: accounts[0] }
        );

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddressOs1 =
            delegation.organizations[0].delegationsManager.options.address;

        var sourceDelegationsManagerAddressOs2 =
            delegation.organizations[1].delegationsManager.options.address;

        var sourceDelegationsManagerAddressAMD =
            delegation.organizations[2].delegationsManager.options.address;

        var balanceFromAmd = await blockchainCall(
            amdToken.methods.balanceOf,
            accounts[7],
            tokenIdAMD
        );

        var amountToWrap = 1;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [sourceDelegationsManagerAddressAMD, accounts[1], "0x"]
        );

        var tx = await blockchainCall(
            amdToken.methods.safeTransferFrom,
            accounts[7],
            DelegationTokensManager.options.address,
            tokenIdAMD,
            amountToWrap,
            encodeWrap,
            { from: accounts[7] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;
        var itemIdAmd = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "TransferSingle(address,address,address,uint256,uint256)"
                    )
            )[1].topics[3]
        );

        assert.equal(
            delegation.treasuryManager.options.address,
            treasuryManager
        );

        var balanceTo = await blockchainCall(
            amdToken.methods.balanceOf,
            treasuryManager,
            tokenIdAMD
        );

        await check1155Balance(
            balanceFromAmd,
            balanceTo.sub(amountToWrap),
            amountToWrap,
            tokenIdAMD,
            accounts[7],
            treasuryManager,
            amdToken
        );

        await checkWrappedItemBalance(
            utilities.toDecimals(amountToWrap, 18),
            accounts[1],
            itemIdAmd,
            itemMainInterface
        );

        await checkSupply(
            utilities.toDecimals(amountToWrap, 18),
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdAmd
            )
        );

        var encoded = [];

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [
                sourceDelegationsManagerAddressOs1,
                utilities.voidEthereumAddress,
                "0x",
            ]
        );

        var encodeWrap2 = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [sourceDelegationsManagerAddressOs2, accounts[7], "0x"]
        );

        encoded.push(encodeWrap);
        encoded.push(encodeWrap2);

        var datas = web3.eth.abi.encodeParameters(["bytes[]"], [encoded]);

        var osBalanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var osSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var amountToWrap1 = (
            await blockchainCall(
                osToken.methods.balanceOf,
                accounts[6],
                tokenIdOs
            )
        ).div(2.4);

        var amountToWrap2 = (
            await blockchainCall(
                osToken.methods.balanceOf,
                accounts[6],
                tokenIdOs
            )
        ).div(3.5);

        var tx = await blockchainCall(
            osToken.methods.safeBatchTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            [tokenIdOs, tokenIdOs],
            [amountToWrap1, amountToWrap2],
            datas,
            { from: accounts[6] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;
        var itemId = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        var itemId2 = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[1].topics[3]
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "TransferSingle(address,address,address,uint256,uint256)"
                    )
            )[1].topics[3]
        );

        var os1BalanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            itemId
        );

        var os2BalanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            itemId2
        );

        await check1155Balance(
            osBalanceFrom.sub(amountToWrap2),
            os1BalanceTo.add(amountToWrap2),
            amountToWrap1,
            tokenIdOs,
            accounts[6],
            treasuryManager,
            osToken
        );

        await check1155Balance(
            osBalanceFrom.sub(amountToWrap1),
            os2BalanceTo.add(amountToWrap1),
            amountToWrap2,
            tokenIdOs,
            accounts[6],
            treasuryManager,
            osToken
        );

        await checkWrappedItemBalance(
            amountToWrap1,
            accounts[6],
            itemId,
            itemMainInterface
        );

        await checkWrappedItemBalance(
            amountToWrap2,
            accounts[7],
            itemId2,
            itemMainInterface
        );

        await checkSupply(
            osSupply,
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                tokenIdOs
            )
        );

        await checkSupply(
            amountToWrap1,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        );

        await checkSupply(
            amountToWrap2,
            await blockchainCall(itemMainInterface.methods.totalSupply, itemId2)
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[7],
            accounts[6],
            itemId2,
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[7],
                itemId2
            ),
            utilities.voidBytes32,
            { from: accounts[7] }
        );

        var osBalanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            tokenIdOs
        );

        var osBalanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[6],
            tokenIdOs
        );

        var delegationOs1BalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemId
        );

        var delegationOs2BalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemId2
        );

        var osSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var delegationOs1Supply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId
        );

        var delegationOs2Supply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemId2
        );

        var encodeUnwrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [utilities.voidEthereumAddress, utilities.voidEthereumAddress, "0x"]
        );

        await blockchainCall(
            itemMainInterface.methods.safeTransferFrom,
            accounts[1],
            accounts[6],
            itemIdAmd,
            await blockchainCall(
                itemMainInterface.methods.balanceOf,
                accounts[1],
                itemIdAmd
            ),
            utilities.voidBytes32,
            { from: accounts[1] }
        );

        var encodeUnwrapAmd = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [utilities.voidEthereumAddress, accounts[7], "0x"]
        );

        await catchCall(
            blockchainCall(
                itemMainInterface.methods.safeTransferFrom,
                accounts[6],
                DelegationTokensManager.options.address,
                itemIdAmd,
                "510000000000000000",
                encodeUnwrapAmd,
                { from: accounts[6] }
            ),
            "non-consistent value"
        );

        await catchCall(
            blockchainCall(
                itemMainInterface.methods.safeTransferFrom,
                accounts[6],
                DelegationTokensManager.options.address,
                itemIdAmd,
                "200000000000000000",
                encodeUnwrapAmd,
                { from: accounts[6] }
            ),
            "non-consistent value"
        );

        var balanceFromAmd = await blockchainCall(
            amdToken.methods.balanceOf,
            treasuryManager,
            tokenIdAMD
        );

        var balanceToAmd = await blockchainCall(
            amdToken.methods.balanceOf,
            accounts[7],
            tokenIdAMD
        );

        var delegationBalanceFrom = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemIdAmd
        );

        var delegationSupply = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            itemIdAmd
        );

        var amountToUnwrapAmd = "1000000000000000000";

        var encodeUnwrapList = [];

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [
                sourceDelegationsManagerAddressOs1,
                utilities.voidEthereumAddress,
                "0x",
            ]
        );

        encodeUnwrapList.push(encodeUnwrap);
        encodeUnwrapList.push(encodeUnwrap);
        encodeUnwrapList.push(encodeUnwrapAmd);
        encodeUnwrapList.push(encodeWrap);

        var datas = web3.eth.abi.encodeParameters(
            ["bytes[]"],
            [encodeUnwrapList]
        );

        var amountToUnwrap = await blockchainCall(
            itemMainInterface.methods.balanceOf,
            accounts[6],
            itemId
        );

        await blockchainCall(
            itemMainInterface.methods.safeBatchTransferFrom,
            accounts[6],
            DelegationTokensManager.options.address,
            [itemId, itemId2, itemIdAmd, tokenIdOs],
            [
                amountToUnwrap.div(2.4),
                amountToUnwrap.div(3.5),
                amountToUnwrapAmd,
                await blockchainCall(
                    osToken.methods.balanceOf,
                    accounts[6],
                    tokenIdOs
                ),
            ],
            datas,
            { from: accounts[6] }
        );

        //   await check1155Balance(
        //     osBalanceFrom,
        //     osBalanceTo,
        //     amountToUnwrap.div(2.4).add(amountToUnwrap.div(3.5)),
        //     tokenIdOs,
        //     treasuryManager,
        //     accounts[6],
        //     osToken
        //   );

        //   assert.equal(
        //     delegationOs1BalanceFrom.sub(amountToUnwrap.div(2.4)),
        //     await blockchainCall(
        //       itemMainInterface.methods.balanceOf,
        //       accounts[6],
        //       itemId
        //     )
        //   );

        //   assert.equal(
        //     delegationOs2BalanceFrom.sub(amountToUnwrap.div(3.5)),
        //     await blockchainCall(
        //       itemMainInterface.methods.balanceOf,
        //       accounts[6],
        //       itemId2
        //     )
        //   );

        //   await checkSupply(
        //     delegationOs1Supply.sub(amountToUnwrap.div(2.4)),
        //     await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        //   );

        //   await checkSupply(
        //     delegationOs2Supply.sub(amountToUnwrap.div(3.5)),
        //     await blockchainCall(itemMainInterface.methods.totalSupply, itemId2)
        //   );

        //   await checkSupply(
        //     osSupply,
        //     await blockchainCall(itemMainInterface.methods.totalSupply, tokenIdOs)
        //   );

        //   await check1155Balance(
        //       balanceFromAmd,
        //       balanceToAmd,
        //       1,
        //       tokenIdAMD,
        //       treasuryManager,
        //       accounts[7],
        //       amdToken
        //     );

        //     assert.equal(
        //       delegationBalanceFrom.sub(amountToUnwrapAmd),
        //       await blockchainCall(
        //         itemMainInterface.methods.balanceOf,
        //         accounts[6],
        //         itemIdAmd
        //       )
        //     );

        //     await checkSupply(
        //       delegationSupply.sub(amountToUnwrapAmd),
        //       await blockchainCall(itemMainInterface.methods.totalSupply, itemIdAmd)
        //     );
    });

    it("Wrap scenario - OS(Main Int.), OS (Interoperable Int.), ETH and USDC", async () => {
    /**
     * Wrap OS (Main Int) x2
     * Wrap OS (Interoperable Int) x2
     * Wrap ETH x2
     * Wrap USDC x2
     * Unwrap Batch OS(Main Int.), OS (Interoperable Int.), ETH and USDC x2
     */
        var tokenHolderOs = "0xdf9e73d45324f20e8bb19f59e8221f9227157b21";
        var tokenHolderOsInteroperable =
            "0x34aaa7c97830c206c42916185bb5e850d8a6b916";
        var tokenHolderAMD = "0x413bbfd677038a80c60db645d2aa64b12ce998b4";
        var tokenHolderUSDC = "0xbcb1c76eaba4c0f66f22e63e4b651b4125916d77";
        await blockchainConnection.unlockAccounts(tokenHolderOs);

        var tokenAddressOs = "0xbf7a3908427cfd975cfceb0e37aaa2d49d72b60a";
        var tokenAddressOsInteroperable =
            "0x20276BA44228370f18cD7a036a4bca1473B8b557";
        var tokenAddressUSDC = "0xeb8f08a975ab53e34d8a0330e0d34de942c95926";
        var tokenIdOs = "183566810637946288783052219345925780922728756567";

        var tokenAddressAMD = "0x474aba21846bf2862946c63bdff6e479d03455a2";
        var tokenIdAMD = "1";

        var osToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressOs
        );

        var amdToken = new web3.eth.Contract(
            knowledgeBase.IERC1155ABI,
            tokenAddressAMD
        );

        var osInteroperableToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            tokenAddressOsInteroperable
        );

        var usdcToken = new web3.eth.Contract(
            knowledgeBase.IERC20ABI,
            tokenAddressUSDC
        );

        var balance = "345353535353552383";
        await blockchainCall(usdcToken.methods.transfer, accounts[0], balance, {
            from: tokenHolderUSDC,
        });

        await blockchainCall(
            osInteroperableToken.methods.transfer,
            accounts[3],
            100,
            {
                from: tokenHolderOsInteroperable,
            }
        );

        await blockchainCall(
            osInteroperableToken.methods.transfer,
            accounts[4],
            100,
            {
                from: tokenHolderOsInteroperable,
            }
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            tokenHolderOs,
            commonData.fromAddress,
            tokenIdOs,
            await blockchainCall(
                osToken.methods.balanceOf,
                tokenHolderOs,
                tokenIdOs
            ),
            utilities.voidBytes32,
            { from: tokenHolderOs }
        );

        await blockchainCall(
            amdToken.methods.safeTransferFrom,
            tokenHolderAMD,
            commonData.fromAddress,
            tokenIdAMD,
            await blockchainCall(
                amdToken.methods.balanceOf,
                tokenHolderAMD,
                tokenIdAMD
            ),
            utilities.voidBytes32,
            { from: tokenHolderAMD }
        );

        var tokens = [
            {
                // os
                address: tokenAddressOs,
                id: tokenIdOs,
            },
            {
                //eth
                address: utilities.voidEthereumAddress,
                id: utilities.voidEthereumAddress,
            },
            {
                //os int
                address: utilities.voidEthereumAddress,
                id: tokenAddressOsInteroperable,
            },
            {
                // usdc
                address: utilities.voidEthereumAddress,
                id: usdcToken.options.address,
            },
        ];
        var delegation = await createCouple(commonData, tokens);

        var amountToTransfer = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[0],
            tokenIdOs
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[0],
            accounts[5],
            tokenIdOs,
            amountToTransfer.div(2),
            utilities.voidBytes32,
            { from: accounts[0] }
        );

        await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[0],
            accounts[4],
            tokenIdOs,
            amountToTransfer.div(2),
            utilities.voidBytes32,
            { from: accounts[0] }
        );

        var DelegationTokensManager = delegation.tokensManager;

        var sourceDelegationsManagerAddressOs =
            delegation.organizations[0].delegationsManager.options.address;

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [sourceDelegationsManagerAddressOs, accounts[4], "0x"]
        );

        var balanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[5],
            tokenIdOs
        );

        var supplyOs = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var osAmountToWrap = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[5],
            tokenIdOs
        );

        var tx = await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[5],
            DelegationTokensManager.options.address,
            tokenIdOs,
            osAmountToWrap,
            encodeWrap,
            { from: accounts[5] }
        );

        var logs = (await web3.eth.getTransactionReceipt(tx.transactionHash))
            .logs;
        var itemIdOs = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        console.log("os1");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdOs
            )
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3(
                        "TransferSingle(address,address,address,uint256,uint256)"
                    )
            )[1].topics[3]
        );

        // assert.equal(
        //     delegation.treasuryManager.options.address,
        //     treasuryManager
        // );

        // var balanceTo = await blockchainCall(
        //     osToken.methods.balanceOf,
        //     treasuryManager,
        //     tokenIdOs
        // );

        // await check1155Balance(
        //     balanceFrom,
        //     balanceTo.sub(osAmountToWrap),
        //     osAmountToWrap,
        //     tokenIdOs,
        //     accounts[5],
        //     treasuryManager,
        //     osToken
        // );

        // await checkWrappedItemBalance(
        //     osAmountToWrap,
        //     accounts[5],
        //     itemIdOs,
        //     itemMainInterface
        // );

        // await checkSupply(
        //     supplyOs,
        //     await blockchainCall(
        //         itemMainInterface.methods.totalSupply,
        //         tokenIdOs
        //     )
        // );

        // await checkSupply(
        //     osAmountToWrap,
        //     await blockchainCall(
        //         itemMainInterface.methods.totalSupply,
        //         itemIdOs
        //     )
        // );

        var encodeWrap = web3.eth.abi.encodeParameters(
            ["address", "address", "bytes"],
            [sourceDelegationsManagerAddressOs, accounts[6], "0x"]
        );

        var balanceFrom = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[4],
            tokenIdOs
        );

        var supplyOs = await blockchainCall(
            itemMainInterface.methods.totalSupply,
            tokenIdOs
        );

        var osAmountToWrap = await blockchainCall(
            osToken.methods.balanceOf,
            accounts[4],
            tokenIdOs
        );

        var tx = await blockchainCall(
            osToken.methods.safeTransferFrom,
            accounts[4],
            DelegationTokensManager.options.address,
            tokenIdOs,
            osAmountToWrap,
            encodeWrap,
            { from: accounts[4] }
        );

        console.log("os1");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdOs
            )
        );

        var balanceTo = await blockchainCall(
            osToken.methods.balanceOf,
            treasuryManager,
            tokenIdOs
        );

        // await check1155Balance(
        //     balanceFrom,
        //     balanceTo.sub(osAmountToWrap),
        //     osAmountToWrap,
        //     tokenIdOs,
        //     accounts[4],
        //     treasuryManager,
        //     osToken
        // );

        // await checkWrappedItemBalance(
        //     osAmountToWrap,
        //     accounts[4],
        //     itemIdOs,
        //     itemMainInterface
        // );

        // await checkSupply(
        //     supplyOs,
        //     await blockchainCall(
        //         itemMainInterface.methods.totalSupply,
        //         tokenIdOs
        //     )
        // );

        // await checkSupply(
        //     osAmountToWrap,
        //     await blockchainCall(
        //         itemMainInterface.methods.totalSupply,
        //         itemIdOs
        //     )
        // );

        // OS wrap
        var sourceDelegationsManagerAddressOsInteroperable =
            delegation.organizations[2].delegationsManager.options.address;

        await blockchainCall(
            osInteroperableToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(
                osInteroperableToken.methods.balanceOf,
                accounts[3]
            ),
            { from: accounts[3] }
        );

        var amountToWrapOsInteroperable = await blockchainCall(
            osInteroperableToken.methods.balanceOf,
            accounts[3]
        );

        var tokenTotalSupply = await blockchainCall(
            osInteroperableToken.methods.totalSupply
        );

        var previousBalanceFrom = await blockchainCall(
            osInteroperableToken.methods.balanceOf,
            accounts[3]
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressOsInteroperable,
            "0x",
            amountToWrapOsInteroperable.div(2),
            accounts[4],
            { from: accounts[3] }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdOsInteroperable = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        console.log("interoperable1");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdOsInteroperable
            )
        );

        var treasuryManagerOsInteroperable = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressOsInteroperable,
            "0x",
            amountToWrapOsInteroperable.div(3),
            accounts[6],
            { from: accounts[3] }
        );

        console.log("interoperable1");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdOsInteroperable
            )
        );

        // assert.equal(
        //     delegation.treasuryManager.options.address,
        //     treasuryManagerOsInteroperable
        // );

        // var previousTreasuryBalanceFrom = await blockchainCall(
        //     osInteroperableToken.methods.balanceOf,
        //     treasuryManagerOsInteroperable
        // );

        // var itemTotalSupply = await blockchainCall(
        //     itemMainInterface.methods.totalSupply,
        //     itemIdOsInteroperable
        // );

        // var itemBalance = await blockchainCall(
        //     itemMainInterface.methods.balanceOf,
        //     accounts[3],
        //     itemIdOsInteroperable
        // );

        // var accountsToBalance = await blockchainCall(
        //     osInteroperableToken.methods.balanceOf,
        //     accounts[3]
        // );

        // await checkBalance(
        //     previousBalanceFrom,
        //     previousTreasuryBalanceFrom.sub(amountToWrapOsInteroperable),
        //     amountToWrapOs,
        //     accounts[3],
        //     treasuryManager,
        //     osInteroperableToken
        // );

        // await checkWrappedItemBalance(
        //     amountToWrapOs,
        //     accounts[4],
        //     itemidOsInteroperable,
        //     itemMainInterface
        // );

        // await checkSupply(
        //     tokenTotalSupply,
        //     await blockchainCall(osInteroperableToken.methods.totalSupply)
        // );

        // await checkSupply(
        //     amountToWrapOsInteroperable,
        //     await blockchainCall(
        //         itemMainInterface.methods.totalSupply,
        //         itemidOsInteroperable
        //     )
        // );

        // WRAP ETH

        var sourceDelegationsManagerAddressEth =
            delegation.organizations[1].delegationsManager.options.address;

        var amountToWrapEth = 0.49498794;

        var previousBalanceFromEth = await web3.eth.getBalance(accounts[5]);

        var previousBalanceToEth = await web3.eth.getBalance(treasuryManager);

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressEth,
            "0x",
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[4],
            {
                from: accounts[5],
                value: utilities.toDecimals(amountToWrapEth, 18),
            }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdEth = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        console.log("eth1");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdEth
            )
        );

        //  var treasuryManagerEth = web3.eth.abi.decodeParameter(
        //      "address",
        //      logs.filter(
        //          (it) =>
        //              it.topics[0] ===
        //              web3.utils.sha3("Transfer(address,address,uint256)")
        //      )[0].topics[2]
        //  );

        //  assert.equal(
        //      await web3.eth.getBalance(accounts[5]),
        //      previousBalanceFromEth
        //          .sub(
        //              await blockchainConnection.calculateTransactionFee(
        //                  wrongWrap1
        //              )
        //          )
        //          .sub(
        //              await blockchainConnection.calculateTransactionFee(
        //                  wrongWrap2
        //              )
        //          )
        //          .sub(await blockchainConnection.calculateTransactionFee(wrap))
        //          .sub(utilities.toDecimals(amountToWrapEth, 18))
        //  );

        //  assert.equal(
        //      await web3.eth.getBalance(treasuryManager),
        //      previousBalanceToEth.add(utilities.toDecimals(amountToWrapEth, 18))
        //  );

        //  await checkWrappedItemBalance(
        //      utilities.toDecimals(amountToWrapEth, 18),
        //      accounts[4],
        //      itemIdEth,
        //      itemMainInterface
        //  );

        //  await checkSupply(
        //      utilities.toDecimals(amountToWrapEth, 18),
        //      await blockchainCall(
        //          itemMainInterface.methods.totalSupply,
        //          itemIdEth
        //      )
        //  );

        // WRAP ETH

        var amountToWrapEth = 0.69498794;

        var previousBalanceFromEth = await web3.eth.getBalance(accounts[1]);

        var previousBalanceToEth = await web3.eth.getBalance(treasuryManager);

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressEth,
            "0x",
            utilities.toDecimals(amountToWrapEth, 18),
            accounts[6],
            {
                from: accounts[1],
                value: utilities.toDecimals(amountToWrapEth, 18),
            }
        );

        console.log("eth2");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdEth
            )
        );

        //  var treasuryManagerEth = web3.eth.abi.decodeParameter(
        //      "address",
        //      logs.filter(
        //          (it) =>
        //              it.topics[0] ===
        //              web3.utils.sha3("Transfer(address,address,uint256)")
        //      )[0].topics[2]
        //  );

        //  assert.equal(
        //      await web3.eth.getBalance(accounts[5]),
        //      previousBalanceFromEth
        //          .sub(
        //              await blockchainConnection.calculateTransactionFee(
        //                  wrongWrap1
        //              )
        //          )
        //          .sub(
        //              await blockchainConnection.calculateTransactionFee(
        //                  wrongWrap2
        //              )
        //          )
        //          .sub(await blockchainConnection.calculateTransactionFee(wrap))
        //          .sub(utilities.toDecimals(amountToWrapEth, 18))
        //  );

        //  assert.equal(
        //      await web3.eth.getBalance(treasuryManager),
        //      previousBalanceToEth.add(utilities.toDecimals(amountToWrapEth, 18))
        //  );

        //  await checkWrappedItemBalance(
        //      utilities.toDecimals(amountToWrapEth, 18),
        //      accounts[4],
        //      itemIdEth,
        //      itemMainInterface
        //  );

        //  await checkSupply(
        //      utilities.toDecimals(amountToWrapEth, 18),
        //      await blockchainCall(
        //          itemMainInterface.methods.totalSupply,
        //          itemIdEth
        //      )
        //  );

        await blockchainCall(
            usdcToken.methods.transfer,
            accounts[2],
            await blockchainCall(usdcToken.methods.balanceOf, accounts[0]),
            {
                from: accounts[0],
            }
        );

        var sourceDelegationsManagerAddressUSDC =
            delegation.organizations[3].delegationsManager.options.address;

        var amountToWrap = (
            await blockchainCall(usdcToken.methods.balanceOf, accounts[2])
        );

        await blockchainCall(
            usdcToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(usdcToken.methods.balanceOf, accounts[2]),
            { from: accounts[2] }
        );

        var wrap = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressUSDC,
            "0x",
            amountToWrap.div(3),
            accounts[4],
            { from: accounts[2] }
        );

        var logs = (await web3.eth.getTransactionReceipt(wrap.transactionHash))
            .logs;
        var itemIdUSDC = web3.eth.abi.decodeParameter(
            "uint256",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("CollectionItem(bytes32,bytes32,uint256)")
            )[0].topics[3]
        );

        console.log("usdc1");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdUSDC
            )
        );

        // await checkBalance(
        //   previousBalanceFrom,
        //   previousTreasuryBalanceFrom,
        //   amountToWrap,
        //   accounts[1],
        //   treasuryManager,
        //   usdcToken
        // );

        // await blockchainCall(
        //   usdcToken.methods.approve,
        //   DelegationTokensManager.options.address,
        //   await blockchainCall(usdcToken.methods.balanceOf, accounts[3]),
        //   { from: accounts[3] }
        // );

        // var amountToWrap3 = await blockchainCall(
        //   usdcToken.methods.balanceOf,
        //   accounts[3]
        // );

        // previousTreasuryBalanceFrom = await blockchainCall(
        //   usdcToken.methods.balanceOf,
        //   treasuryManager
        // );

        await blockchainCall(
            usdcToken.methods.approve,
            DelegationTokensManager.options.address,
            await blockchainCall(usdcToken.methods.balanceOf, accounts[2]),
            { from: accounts[2] }
        );

        var wrap3 = await blockchainCall(
            DelegationTokensManager.methods.wrap,
            sourceDelegationsManagerAddressUSDC,
            "0x",
            amountToWrap.div(2),
            accounts[6],
            { from: accounts[2] }
        );

        console.log("usdc2");
        console.log(
            await blockchainCall(
                itemMainInterface.methods.totalSupply,
                itemIdUSDC
            )
        );

        var treasuryManager = web3.eth.abi.decodeParameter(
            "address",
            logs.filter(
                (it) =>
                    it.topics[0] ===
                    web3.utils.sha3("Transfer(address,address,uint256)")
            )[0].topics[2]
        );

        // assert.equal(
        //   delegation.treasuryManager.options.address,
        //   treasuryManager
        // );

        // await checkBalance(
        //   previousBalanceFrom3,
        //   previousTreasuryBalanceFrom,
        //   amountToWrap3,
        //   accounts[3],
        //   treasuryManager,
        //   usdcToken
        // );

        // await checkWrappedItemBalance(
        //   utilities.normalizeValue(amountToWrap, 6),
        //   accounts[2],
        //   itemId,
        //   itemMainInterface
        // );

        // await checkSupply(
        //   tokenTotalSupply,
        //   await blockchainCall(usdcToken.methods.totalSupply)
        // );

        // await checkFromBalance(
        //   await blockchainCall(usdcToken.methods.balanceOf, accounts[3]),
        //   amountToWrap3,
        //   previousBalanceFrom3
        // );

        // await checkWrappedItemBalance(
        //   utilities.normalizeValue(amountToWrap3, 6),
        //   accounts[3],
        //   itemId,
        //   itemMainInterface
        // );

        // await checkSupply(
        //   tokenTotalSupply,
        //   await blockchainCall(usdcToken.methods.totalSupply)
        // );

        // await checkSupply(
        //   utilities.normalizeValue(amountToWrap.add(amountToWrap3), 6),
        //   await blockchainCall(itemMainInterface.methods.totalSupply, itemId)
        // );
    });
});