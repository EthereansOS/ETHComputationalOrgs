var itemProjectionFactory;
var nftDynamicUriRenderer;

async function deployNativeModel(commonData) {

    var NativeProjection = await compile("../node_modules/@ethereansos/items-core/contracts/projection/native/NativeProjection");
    var nativeProjectionBytecode = new web3.eth.Contract(NativeProjection.abi).deploy({ data: NativeProjection.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.addModel, nativeProjectionBytecode, {from : commonData.from, gasLimit : '6000000'});
}

async function deployERC20WrapperSingleton(commonData) {

    var ERC20WrapperUriRenderer = await compile('../node_modules/@ethereansos/items-core/contracts/projection/ERC20/ERC20WrapperUriRenderer');
    var erc20WrapperUriRenderer = await deployContract(new web3.eth.Contract(ERC20WrapperUriRenderer.abi), ERC20WrapperUriRenderer.bin, [commonData.fromAddress, "myUri"], {from : commonData.from});
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

    deployParam = abi.encode(["address", "bytes"], [commonData.fromAddress, deployParam]);

    var ERC20Wrapper = await compile("../node_modules/@ethereansos/items-core/contracts/projection/ERC20/ERC20Wrapper");
    var erc20WrapperDeployData = await new web3.eth.Contract(ERC20Wrapper.abi).deploy({ data: ERC20Wrapper.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.deploySingleton, erc20WrapperDeployData, deployParam, {from : commonData.from});
}

async function deployERC721WrapperSingleton(commonData) {

    var NFTDynamicUriRenderer = await compile('../node_modules/@ethereansos/items-core/contracts/util/NFTDynamicUriRenderer');
    nftDynamicUriRenderer = await deployContract(new web3.eth.Contract(NFTDynamicUriRenderer.abi), NFTDynamicUriRenderer.bin, [commonData.fromAddress, "myUri"], {from : commonData.from});
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

    deployParam = abi.encode(["address", "bytes"], [commonData.fromAddress, deployParam]);

    var ERC721Wrapper = await compile("../node_modules/@ethereansos/items-core/contracts/projection/ERC721/ERC721Wrapper");
    var erc721WrapperDeployData = await new web3.eth.Contract(ERC721Wrapper.abi).deploy({ data: ERC721Wrapper.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.deploySingleton, erc721WrapperDeployData, deployParam, {from : commonData.from});
}

async function deployERC1155WrapperSingleton(commonData) {

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

    deployParam = abi.encode(["address", "bytes"], [commonData.fromAddress, deployParam]);

    var ERC1155Wrapper = await compile("../node_modules/@ethereansos/items-core/contracts/projection/ERC1155/ERC1155Wrapper");
    var erc1155WrapperDeploy = await new web3.eth.Contract(ERC1155Wrapper.abi).deploy({ data: ERC1155Wrapper.bin, arguments: ["0x"] }).encodeABI();
    await blockchainCall(itemProjectionFactory.methods.deploySingleton, erc1155WrapperDeploy, deployParam, {from : commonData.from});
}

module.exports = async function deploy(commonData) {

    var ItemProjectionFactory = await compile('../node_modules/@ethereansos/items-core/contracts/projection/factory/impl/ItemProjectionFactory');
    itemProjectionFactory = new web3.eth.Contract(ItemProjectionFactory.abi, commonData.ITEM_PROJECTION_FACTORY);

    console.log("ITEM-V2 Projections");

    console.log("Creating Native Model");
    await deployNativeModel(commonData);

    console.log("Creating ERC20 Uri Renderer and Singleton");
    await deployERC20WrapperSingleton(commonData);

    console.log("Creating ERC721 Uri Renderer and Singleton");
    await deployERC721WrapperSingleton(commonData);

    console.log("Creating ERC1155 Singleton");
    await deployERC1155WrapperSingleton(commonData);

    return commonData
}