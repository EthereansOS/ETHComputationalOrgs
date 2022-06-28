describe("Farming", () => {
    it("test", async () => {
        var from = "0x34aaa7C97830c206c42916185BB5e850D8a6B916";
        try {
            await blockchainConnection.unlockAccounts(from)
        } catch(e) {
        }

        var farmingContractAddress = "0x882149945f1bD6Ca82269f4A317D72ef633E26b6";

        var FarmingContract = await compile('../resources/FarmMainRegularMinStake', "FarmMainRegularMinStake", "0.7.6")
        var FOF = await compile('ethereans/factoryOfFactories/impl/FactoryOfFactories')
        new web3.eth.Contract(FOF.abi)
        var StateManager = await compile('base/impl/StateManager')
        new web3.eth.Contract(StateManager.abi)
        var SubDAO = await compile('ext/subdao/impl/SubDAO')
        new web3.eth.Contract(SubDAO.abi)
        var farmingContract = new web3.eth.Contract(FarmingContract.abi, farmingContractAddress)
        var positionId = "88359357856372982074899491159344714667632230178821462760563363016629649878833"
        var position = await farmingContract.methods.position(positionId).call()
        var liquidityPoolTokenAmount = "74590972242631824197";//"92564113704105208600"

        var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
        var osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        //global.web3 = new(require('web3'))(process.env.BLOCKCHAIN_CONNECTION_STRING);
        farmingContract = new web3.eth.Contract(FarmingContract.abi, farmingContractAddress)
        var mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);
        data.OS_COLLECTION_ID = (await mainInterface.methods.item(data.OS_ID).call()).collectionId;
        data.OS_PROJECTION = (await mainInterface.methods.collection(data.OS_COLLECTION_ID).call()).host;

        data.DYNAMIC_URI_RESOLVER = await mainInterface.methods.dynamicUriResolver().call();
        data.ITEM_PROJECTION_FACTORY = await mainInterface.methods.hostInitializer().call();

        await blockchainCall(mainInterface.methods.setApprovalForAll, "0x7D24b29430A68894F3C34D4535E1b2e12Be4b97C", true,{from : "45274e38aec79ee77b32039ae408e9b0867be85dcc5ba292b92d1f5ee7ef2a6e"})
        var bytes = web3.eth.abi.encodeParameters(["bool", "bytes"], [false, "0x"])
        await blockchainCall(farmingContract.methods.withdrawLiquidity, positionId, liquidityPoolTokenAmount, bytes, {from : "45274e38aec79ee77b32039ae408e9b0867be85dcc5ba292b92d1f5ee7ef2a6e"})
    })
})