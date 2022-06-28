var organizationManager = require('../resources/organization');
describe("EthOSTokens", () => {

    var organization;

    before(async () => {
        organization = await organizationManager.createOrganization();
    });

    it("test", async () => {
        var ItemInteroperableInterface = await compile('../node_modules/@ethereansos/items-core/contracts/impl/ItemInteroperableInterface');
        var itemInteroperableInterface = new web3.eth.Contract(ItemInteroperableInterface.abi, knowledgeBase.osTokenAddress);

        var ItemMainInterface = await compile('../node_modules/@ethereansos/items-core/contracts/impl/ItemMainInterface');
        var itemMainInterface = new web3.eth.Contract(ItemMainInterface.abi, await itemInteroperableInterface.methods.mainInterface().call());

        var itemId = await itemInteroperableInterface.methods.itemId().call();
        var itemData = await itemMainInterface.methods.item(itemId).call();
        var collectionId = itemData.collectionId;
        var collectionData = await itemMainInterface.methods.collection(collectionId).call();
        collectionData = { ...collectionData };

        var MultipleHostPerSingleItem = await compile('ethos/EthOSTokens/impl/MultipleHostPerSingleItem');
        var multipleHostPerSingleItem = await new web3.eth.Contract(MultipleHostPerSingleItem.abi).deploy({ data: MultipleHostPerSingleItem.bin, arguments: ["0x"] }).send(blockchainConnection.getSendingOptions());

        var IndividualHostPerItemCollection = await compile('ethos/EthOSTokens/impl/IndividualHostPerItemCollection');
        var data = web3.eth.abi.encodeParameters(["uint256[]", "address[]"], [
            [itemId],
            [multipleHostPerSingleItem.options.address]
        ]);
        data = abi.encode([
            "bytes32",
            "tuple(address,string,string,string)",
            "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
            "bytes"
        ], [
            collectionId,
            [utilities.voidEthereumAddress, "", "", ""],
            [],
            data
        ]);
        data = web3.eth.abi.encodeParameters(["address", "bytes"], [itemMainInterface.options.address, data]);
        data = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, data]);
        var ethOSTokensCollection = await new web3.eth.Contract(IndividualHostPerItemCollection.abi).deploy({ data: IndividualHostPerItemCollection.bin, arguments: [data] }).send(blockchainConnection.getSendingOptions());
        assert.equal(await ethOSTokensCollection.methods.itemHost(itemId).call(), multipleHostPerSingleItem.options.address);

        data = web3.eth.abi.encodeParameters(["address", "uint256", "bytes"], [ethOSTokensCollection.options.address, itemId, "0x"]);
        data = web3.eth.abi.encodeParameters(["address", "bytes"], [organization.address, data]);
        await multipleHostPerSingleItem.methods.lazyInit(data).send(blockchainConnection.getSendingOptions());

        var osMinterAuthorized = accounts[5];
        try {
            await blockchainConnection.unlockAccounts(osMinterAuthorized);
        } catch(e) {
        }

        var mintSelector = web3.utils.sha3('mint(address,uint256)').substring(0, 10);
        var batchMintSelector = web3.utils.sha3('batchMint(address[],uint256[])').substring(0, 10);
        var setMetadataSelector = web3.utils.sha3('setMetadata(string,string,string)').substring(0, 10);
        var setAuthorizedSelector = web3.utils.sha3('setAuthorized(address,bool)').substring(0, 10);
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call()));
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call());
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call());
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call()));

        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], utilities.numberToString(1e18)).send(blockchainConnection.getSendingOptions({from : osMinterAuthorized})), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.batchMint([accounts[0]], [utilities.numberToString(1e18)]).send(blockchainConnection.getSendingOptions( { from : osMinterAuthorized})), "unauthorized");

        await catchCall(multipleHostPerSingleItem.methods.setAuthorized(osMinterAuthorized, true).send(blockchainConnection.getSendingOptions({from : accounts[1]})), "unauthorized");
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call()));
        await organization.contract.methods.submit(multipleHostPerSingleItem.options.address, multipleHostPerSingleItem.methods.setAuthorized(osMinterAuthorized, true).encodeABI(), utilities.voidEthereumAddress).send(organization.asActiveComponent);
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call());
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call());
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call()));

        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call());

        var oldHost = collectionData.host;
        await blockchainConnection.unlockAccounts(oldHost);
        collectionData.host = ethOSTokensCollection.options.address;
        await catchCall(itemMainInterface.methods.setCollectionsMetadata([collectionId], [collectionData]), "unauthorized");
        await itemMainInterface.methods.setCollectionsMetadata([collectionId], [collectionData]).send(blockchainConnection.getSendingOptions({from : oldHost}));
        collectionData = await itemMainInterface.methods.collection(collectionId).call();
        assert.notStrictEqual(oldHost, collectionData.host);
        assert.equal(ethOSTokensCollection.options.address, collectionData.host);

        await multipleHostPerSingleItem.methods.mint(accounts[0], utilities.numberToString(1e18)).send(blockchainConnection.getSendingOptions({from : osMinterAuthorized}));
        await multipleHostPerSingleItem.methods.batchMint([accounts[0]], [utilities.numberToString(1e18)]).send(blockchainConnection.getSendingOptions( { from : osMinterAuthorized}));

        await catchCall(multipleHostPerSingleItem.methods.setAuthorized(osMinterAuthorized, false).send(blockchainConnection.getSendingOptions({from : osMinterAuthorized})), "unauthorized");
        await organization.contract.methods.submit(multipleHostPerSingleItem.options.address, multipleHostPerSingleItem.methods.setAuthorized(osMinterAuthorized, false).encodeABI(), utilities.voidEthereumAddress).send(organization.asActiveComponent);
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call()));

        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], utilities.numberToString(1e18)).send(blockchainConnection.getSendingOptions({from : osMinterAuthorized})), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.batchMint([accounts[0]], [utilities.numberToString(1e18)]).send(blockchainConnection.getSendingOptions( { from : osMinterAuthorized})), "unauthorized");

        await organization.contract.methods.submit(multipleHostPerSingleItem.options.address, multipleHostPerSingleItem.methods.setAuthorized(osMinterAuthorized, true).encodeABI(), utilities.voidEthereumAddress).send(organization.asActiveComponent);
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call());
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call());
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call()));

        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call());

        await multipleHostPerSingleItem.methods.mint(accounts[0], utilities.numberToString(1e18)).send(blockchainConnection.getSendingOptions({from : osMinterAuthorized}));
        await multipleHostPerSingleItem.methods.batchMint([accounts[0]], [utilities.numberToString(1e18)]).send(blockchainConnection.getSendingOptions( { from : osMinterAuthorized}));

        var expectedTotalSupply = await itemInteroperableInterface.methods.totalSupply().call();

        var value = "39.152".toDecimals(18);

        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], value), "unauthorized");
        assert.equal(expectedTotalSupply, await itemInteroperableInterface.methods.totalSupply().call());

        expectedTotalSupply = expectedTotalSupply.add(value);

        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], value), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], value).send(blockchainConnection.getSendingOptions({from : await multipleHostPerSingleItem.methods.host().call()})), "unauthorized");
        await multipleHostPerSingleItem.methods.mint(accounts[0], value).send(blockchainConnection.getSendingOptions({from : osMinterAuthorized}));
        assert.equal(expectedTotalSupply, await itemInteroperableInterface.methods.totalSupply().call());

        var itemData = { ...(await itemMainInterface.methods.item(itemId).call()) };
        var name = await itemInteroperableInterface.methods.name().call();
        var symbol = await itemInteroperableInterface.methods.symbol().call();
        assert.equal(itemData.header.name, name);
        assert.equal(itemData.header.symbol, symbol);

        var newName = 'newOS';
        var newSymbol = 'nOS';
        var newUri = 'https://google.com';

        itemData = {
            name : newName,
            symbol : newSymbol,
            uri : newUri,
            host : multipleHostPerSingleItem.options.address
        };

        await catchCall(multipleHostPerSingleItem.methods.setMetadata(itemData), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.setMetadata(itemData).send(blockchainConnection.getSendingOptions( {from : osMinterAuthorized} )), "unauthorized");
        await organization.contract.methods.submit(multipleHostPerSingleItem.options.address, multipleHostPerSingleItem.methods.setMetadata(itemData).encodeABI(), utilities.voidEthereumAddress).send(organization.asActiveComponent);

        assert.equal(itemData.host, await ethOSTokensCollection.methods.itemHost(itemId).call());

        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call()));
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call());
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(await multipleHostPerSingleItem.methods.host().call(), multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call());

        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, mintSelector, '0x', 0).call());
        assert(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, batchMintSelector, '0x', 0).call());
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setMetadataSelector, '0x', 0).call()));
        assert(!(await multipleHostPerSingleItem.methods.subjectIsAuthorizedFor(osMinterAuthorized, multipleHostPerSingleItem.options.address, setAuthorizedSelector, '0x', 0).call()));

        itemData = await itemMainInterface.methods.item(itemId).call();
        name = await itemInteroperableInterface.methods.name().call();
        symbol = await itemInteroperableInterface.methods.symbol().call();
        assert.equal(itemData.header.name, name);
        assert.equal(itemData.header.symbol, symbol);

        assert.equal(newName, name);
        assert.equal(newSymbol, symbol);
        assert.equal(newUri, itemData.header.uri);

        var receivers = [
            accounts[3],
            accounts[9],
            accounts[2]
        ];

        var amounts = [];

        var expectedBalances = [];

        expectedTotalSupply = await itemInteroperableInterface.methods.totalSupply().call();

        await Promise.all(receivers.map(async receiver => {
            var amount = Math.random().toDecimals(18);
            amounts.push(amount);
            var prevBalance = await itemInteroperableInterface.methods.balanceOf(receiver).call();
            expectedBalances.push(prevBalance.add(amount));
            expectedTotalSupply = expectedTotalSupply.add(amount);
        }));

        await catchCall(multipleHostPerSingleItem.methods.batchMint(receivers, amounts), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.batchMint(receivers, amounts).send(blockchainConnection.getSendingOptions({from : await multipleHostPerSingleItem.methods.host().call()})), "unauthorized");
        await multipleHostPerSingleItem.methods.batchMint(receivers, amounts).send(blockchainConnection.getSendingOptions( { from : osMinterAuthorized}));

        assert.equal(expectedTotalSupply, await itemInteroperableInterface.methods.totalSupply().call());

        for(var i in receivers) {
            assert.equal(expectedBalances[i], await itemInteroperableInterface.methods.balanceOf(receivers[i]).call());
        }

        itemData = {
            name : newName,
            symbol : newSymbol,
            uri : newUri,
            host : utilities.voidEthereumAddress
        };

        oldHost = await ethOSTokensCollection.methods.itemHost(itemId).call();
        assert.notStrictEqual(itemData.host, await ethOSTokensCollection.methods.itemHost(itemId).call());

        await organization.contract.methods.submit(multipleHostPerSingleItem.options.address, multipleHostPerSingleItem.methods.setMetadata(itemData).encodeABI(), utilities.voidEthereumAddress).send(organization.asActiveComponent);

        assert.notStrictEqual(oldHost, await ethOSTokensCollection.methods.itemHost(itemId).call());
        assert.equal(itemData.host, await ethOSTokensCollection.methods.itemHost(itemId).call());

        await catchCall(multipleHostPerSingleItem.methods.setMetadata(itemData), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.setMetadata(itemData).send(blockchainConnection.getSendingOptions( {from : osMinterAuthorized} )), "unauthorized");
        await catchCall(organization.contract.methods.submit(multipleHostPerSingleItem.options.address, multipleHostPerSingleItem.methods.setMetadata(itemData).encodeABI(), utilities.voidEthereumAddress).send(organization.asActiveComponent), "unauthorized");

        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], value), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], value).send(blockchainConnection.getSendingOptions({from : await multipleHostPerSingleItem.methods.host().call()})), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.mint(accounts[0], value).send(blockchainConnection.getSendingOptions({from : osMinterAuthorized})), "unauthorized");

        await catchCall(multipleHostPerSingleItem.methods.batchMint(receivers, amounts), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.batchMint(receivers, amounts).send(blockchainConnection.getSendingOptions({from : await multipleHostPerSingleItem.methods.host().call()})), "unauthorized");
        await catchCall(multipleHostPerSingleItem.methods.batchMint(receivers, amounts).send(blockchainConnection.getSendingOptions( { from : osMinterAuthorized})), "unauthorized");

        var items = [{
            header : {
                host : utilities.voidEthereumAddress,
                name : 'franco',
                symbol : 'TST',
                uri : ''
            },
            collectionId : utilities.voidBytes32,
            id : 0,
            accounts : [
                accounts[0],
                accounts[1],
                accounts[2],
                accounts[3]
            ],
            amounts : [
                Math.random().toDecimals(18),
                Math.random().toDecimals(18),
                Math.random().toDecimals(18),
                Math.random().toDecimals(18)
            ]
        }];

        var transaction = await ethOSTokensCollection.methods.mintItems(items).send(blockchainConnection.getSendingOptions());
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var log = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('CollectionItem(bytes32,bytes32,uint256)'))[0];
        var newItemId = web3.eth.abi.decodeParameter("uint256", log.topics[3]);
        console.log(newItemId);

        var newItemData = await itemMainInterface.methods.item(newItemId).call();
        assert.equal(collectionId, newItemData.collectionId);

        assert.equal(utilities.voidEthereumAddress, newItemData.header.host);
        assert.equal(items[0].header.host, await ethOSTokensCollection.methods.itemHost(newItemId).call());
        assert.equal(items[0].header.name, newItemData.header.name);
        assert.equal(items[0].header.symbol, newItemData.header.symbol);
        assert.equal(collectionData.uri, newItemData.header.uri);

        var expectedAmount = items[0].amounts.reduce((a, b) => a.add(b));

        assert.equal(expectedAmount, await itemMainInterface.methods.totalSupply(newItemId).call());

        items[0].id = newItemId;
        await catchCall(ethOSTokensCollection.methods.mintItems(items), 'unauthorized');

        items = [{
            header : {
                host : accounts[6],
                name : 'franco',
                symbol : 'TST',
                uri : ''
            },
            collectionId : utilities.voidBytes32,
            id : 0,
            accounts : [
                accounts[0],
                accounts[1],
                accounts[2],
                accounts[3]
            ],
            amounts : [
                Math.random().toDecimals(18),
                Math.random().toDecimals(18),
                Math.random().toDecimals(18),
                Math.random().toDecimals(18)
            ]
        }];

        var transaction = await ethOSTokensCollection.methods.mintItems(items).send(blockchainConnection.getSendingOptions());
        transaction = await web3.eth.getTransactionReceipt(transaction.transactionHash);
        var log = transaction.logs.filter(it => it.topics[0] === web3.utils.sha3('CollectionItem(bytes32,bytes32,uint256)'))[0];
        var newItemId = web3.eth.abi.decodeParameter("uint256", log.topics[3]);
        console.log(newItemId);

        var newItemData = await itemMainInterface.methods.item(newItemId).call();
        assert.equal(collectionId, newItemData.collectionId);

        assert.equal(utilities.voidEthereumAddress, newItemData.header.host);
        assert.equal(items[0].header.host, await ethOSTokensCollection.methods.itemHost(newItemId).call());
        assert.equal(items[0].header.name, newItemData.header.name);
        assert.equal(items[0].header.symbol, newItemData.header.symbol);
        assert.equal(collectionData.uri, newItemData.header.uri);

        var expectedAmount = items[0].amounts.reduce((a, b) => a.add(b));

        assert.equal(expectedAmount, await itemMainInterface.methods.totalSupply(newItemId).call());

        expectedAmount = expectedAmount.add(await itemMainInterface.methods.totalSupply(newItemId).call());

        items[0].id = newItemId;
        await catchCall(ethOSTokensCollection.methods.mintItems(items), 'unauthorized');

        await ethOSTokensCollection.methods.mintItems(items).send(blockchainConnection.getSendingOptions({from : items[0].header.host}));

        assert.equal(expectedAmount, await itemMainInterface.methods.totalSupply(newItemId).call());
    });
});