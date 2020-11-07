var itemProjectionFactory;
var nftDynamicUriRenderer;

async function deployNativeModel(sendingOptions) {

    var NativeProjection = await compile("../node_modules/@ethereansos/items-v2/contracts/projection/native/NativeProjection");
    var nativeProjectionBytecode = new web3.eth.Contract(NativeProjection.abi).deploy({ data: NativeProjection.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.addModel, nativeProjectionBytecode, sendingOptions);
}

async function deployERC20WrapperSingleton(sendingOptions) {

    var fromAddress = web3.eth.accounts.privateKeyToAccount(sendingOptions).address;

    var ERC20WrapperUriRenderer = await compile('../node_modules/@ethereansos/items-v2/contracts/projection/ERC20/ERC20WrapperUriRenderer');
    var erc20WrapperUriRenderer = await deployContract(new web3.eth.Contract(ERC20WrapperUriRenderer.abi), ERC20WrapperUriRenderer.bin, [fromAddress, "myUri"], sendingOptions);
    var uri = web3.eth.abi.encodeParameters(["address", "bytes"], [erc20WrapperUriRenderer.options.address, "0x"]);

    var header = {
        host: utilities.voidEthereumAddress,
        name: "ERC20Wrapper",
        symbol: "W20",
        uri
    };

    var deployParam = abi.encode(
        [
            "bytes32",
            "tuple(address,string,string,string)",
            "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
            "bytes"
        ], [
            utilities.voidBytes32,
            Object.values(header),
            [],
            "0x"
        ]
    );

    deployParam = abi.encode(["address", "bytes"], [fromAddress, deployParam]);

    var ERC20Wrapper = await compile("../node_modules/@ethereansos/items-v2/contracts/projection/ERC20/ERC20Wrapper");
    var erc20WrapperDeployData = await new web3.eth.Contract(ERC20Wrapper.abi).deploy({ data: ERC20Wrapper.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.deploySingleton, erc20WrapperDeployData, deployParam, sendingOptions);
}

async function deployERC721WrapperSingleton(sendingOptions) {

    var fromAddress = web3.eth.accounts.privateKeyToAccount(sendingOptions).address;

    var NFTDynamicUriRenderer = await compile('../node_modules/@ethereansos/items-v2/contracts/util/NFTDynamicUriRenderer');
    nftDynamicUriRenderer = await deployContract(new web3.eth.Contract(NFTDynamicUriRenderer.abi), NFTDynamicUriRenderer.bin, [fromAddress, "myUri"], sendingOptions);
    var uri = web3.eth.abi.encodeParameters(["address", "bytes"], [nftDynamicUriRenderer.options.address, "0x"]);

    var header = {
        host: utilities.voidEthereumAddress,
        name: "ERC721Wrapper",
        symbol: "W721",
        uri
    };

    var deployParam = abi.encode(
        [
            "bytes32",
            "tuple(address,string,string,string)",
            "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
            "bytes"
        ], [
            utilities.voidBytes32,
            Object.values(header),
            [],
            "0x"
        ]
    );

    deployParam = abi.encode(["address", "bytes"], [fromAddress, deployParam]);

    var ERC721Wrapper = await compile("../node_modules/@ethereansos/items-v2/contracts/projection/ERC721/ERC721Wrapper");
    var erc721WrapperDeployData = await new web3.eth.Contract(ERC721Wrapper.abi).deploy({ data: ERC721Wrapper.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.deploySingleton, erc721WrapperDeployData, deployParam, sendingOptions);
}

async function deployERC1155WrapperSingleton(sendingOptions) {

    var fromAddress = web3.eth.accounts.privateKeyToAccount(sendingOptions).address;

    var uri = web3.eth.abi.encodeParameters(["address", "bytes"], [nftDynamicUriRenderer.options.address, "0x"]);

    var header = {
        host: utilities.voidEthereumAddress,
        name: "ERC1155Wrapper",
        symbol: "W1155",
        uri
    };

    var deployParam = abi.encode(
        [
            "bytes32",
            "tuple(address,string,string,string)",
            "tuple(tuple(address,string,string,string),bytes32,uint256,address[],uint256[])[]",
            "bytes"
        ], [
            utilities.voidBytes32,
            Object.values(header),
            [],
            "0x"
        ]
    );

    deployParam = abi.encode(["address", "bytes"], [fromAddress, deployParam]);

    var ERC1155Wrapper = await compile("../node_modules/@ethereansos/items-v2/contracts/projection/ERC1155/ERC1155Wrapper");
    var erc1155WrapperDeploy = await new web3.eth.Contract(ERC1155Wrapper.abi).deploy({ data: ERC1155Wrapper.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.deploySingleton, erc1155WrapperDeploy, deployParam, sendingOptions);
}

module.exports = async function deploy(commonData) {

    var sendingOptions = {from : commonData.from};

    var ItemProjectionFactory = await compile('../node_modules/@ethereansos/items-v2/contracts/projection/factory/impl/ItemProjectionFactory');
    itemProjectionFactory = new web3.eth.Contract(ItemProjectionFactory.abi, commonData.ITEM_PROJECTION_FACTORY);

    console.log("ITEM-V2 Projections");

    console.log("Creating Native Model");
    await deployNativeModel(sendingOptions);

    console.log("Creating ERC20 Uri Renderer and Singleton");
    await deployERC20WrapperSingleton(sendingOptions);

    console.log("Creating ERC721 Uri Renderer and Singleton");
    await deployERC721WrapperSingleton(sendingOptions);

    console.log("Creating ERC1155 Singleton");
    await deployERC1155WrapperSingleton(sendingOptions);
}