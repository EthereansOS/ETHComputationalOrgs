var dynamicUriResolverAddress;
var itemProjectionFactory;

async function deployCollection(header, items, sendingOptions) {
    try {
        var headerArray = Object.values(header);
        var itemsArray = items.map(item => [Object.values(item.header), ...Object.values(item).slice(1)]);
        var headerTuple = "tuple(address,string,string,string)";
        var itemsTuple = `tuple(${headerTuple},bytes32,uint256,address[],uint256[])[]`;

        var data = web3.eth.abi.encodeParameters(["uint256[]", "address[]"], [[1, 4], [header.host, header.host]]);
        data = abi.encode(["bytes32", headerTuple, itemsTuple, "bytes"], [utilities.voidBytes32, headerArray, itemsArray, data]);
        data = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, data]);
        data = web3.eth.abi.encodeParameters(["uint256", "bytes"], [0, data]);
        var transaction = await blockchainCall(itemProjectionFactory.methods.deploy, data, sendingOptions);
        return transaction;
    } catch(e) {
        console.error(e);
        throw e;
    }
};

async function prepareMainInterfaceDeploy(sendingOptions) {
    var ItemMainInterface = await compile('../node_modules/@ethereansos/items-core/contracts/impl/ItemMainInterface');

    var ItemInteroperableInterface = await compile('../node_modules/@ethereansos/items-core/contracts/impl/ItemInteroperableInterface');
    var ItemMainInterfaceSupportsInterfaceImplementer = await compile('../node_modules/@ethereansos/items-core/contracts/impl/ItemMainInterfaceSupportsInterfaceImplementer');

    var DynamicUriResolver = await compile('../node_modules/@ethereansos/swissknife/contracts/dynamicMetadata/impl/DynamicUriResolver');
    dynamicUriResolverAddress = (await deployContract(new web3.eth.Contract(DynamicUriResolver.abi), DynamicUriResolver.bin, undefined, sendingOptions)).options.address;

    var singletonUri = "ipfs://ipfs/QmcF2RPjEZEjSsbmR8Zc3jVC7QXnHL3wYKMaiWZiEZ8oA2";
    var arguments = [
        singletonUri,
        dynamicUriResolverAddress,
        new web3.eth.Contract(ItemInteroperableInterface.abi).deploy({ data: ItemInteroperableInterface.bin }).encodeABI(),
        await new web3.eth.Contract(ItemMainInterfaceSupportsInterfaceImplementer.abi).deploy({ data: ItemMainInterfaceSupportsInterfaceImplementer.bin }).encodeABI()
    ];
    return new web3.eth.Contract(ItemMainInterface.abi).deploy({ data: ItemMainInterface.bin, arguments }).encodeABI();
};

async function prepareMultiOperatorHostDeployData() {
    var MultiOperatorHost = await compile('../node_modules/@ethereansos/items-core/contracts/projection/multiOperatorHost/impl/MultiOperatorHost');
    return new web3.eth.Contract(MultiOperatorHost.abi).deploy({ data: MultiOperatorHost.bin, arguments : ["0x"] }).encodeABI();
}

module.exports = async function deploy(commonData) {

    console.log("Creating Dynamic Uri Resolver");

    var sendingOptions = {from : commonData.from};

    var data = web3.eth.abi.encodeParameters(["bytes", "bytes[]"], [await prepareMainInterfaceDeploy(sendingOptions), [await prepareMultiOperatorHostDeployData()]]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, data]);
    data = web3.eth.abi.encodeParameters(["string", "address", "bytes"], ["myUri", dynamicUriResolverAddress, data]);
    data = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.fromAddress, data]);

    console.log("Creating Item Projection Factory");
    var ItemProjectionFactory = await compile('../node_modules/@ethereansos/items-core/contracts/projection/factory/impl/ItemProjectionFactory');
    itemProjectionFactory = await deployContract(new web3.eth.Contract(ItemProjectionFactory.abi), ItemProjectionFactory.bin, [data], sendingOptions);

    console.log("Creating OS Token");

    var transaction = await deployCollection({
        host: commonData.fromAddress,
        name: "Ethereans",
        symbol: "OS",
        uri: "ipfs://ipfs/QmU2FA9sC2jpkrXa9P2X9nQ6pWh8dy8Bgv5EYYfE97Y94r"
    }, [{
        header: {
            host: utilities.voidEthereumAddress,
            name: "Ethereans",
            symbol: "OS",
            uri: "ipfs://ipfs/QmU2FA9sC2jpkrXa9P2X9nQ6pWh8dy8Bgv5EYYfE97Y94r"
        },
        collectionId: utilities.voidBytes32,
        id: 0,
        accounts: [commonData.fromAddress],
        amounts: ["1000000".mul(1e18)]
    }], sendingOptions);

    var transactionReceipt = await web3.eth.getTransactionReceipt(transaction.transactionHash);
    commonData.OS_ADDRESS = transactionReceipt.logs.filter(it => it.topics[0] === web3.utils.sha3('Transfer(address,address,uint256)'))[0].address;

    try {
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, commonData.OS_ADDRESS);

        commonData.OS_ID = await osAddress.methods.itemId().call();
        commonData.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, commonData.ITEM_MAININTERFACE);

        commonData.OS_COLLECTION_ID = (await mainInterface.methods.item(commonData.OS_ID).call()).collectionId;
        commonData.OS_PROJECTION = (await mainInterface.methods.collection(commonData.OS_COLLECTION_ID).call()).host;

        commonData.DYNAMIC_URI_RESOLVER = await mainInterface.methods.dynamicUriResolver().call();
        commonData.ITEM_PROJECTION_FACTORY = await mainInterface.methods.hostInitializer().call();
    } catch(e) {
    }

    return commonData;
}