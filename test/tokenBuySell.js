var fs = require('fs')

describe("Token Buy/Sell", () => {

    var commonData;
    try {
        commonData = {...commonData, ...JSON.parse(fs.readFileSync("C:/Users/Marco/Desktop/dump_rinkeby_json.json", 'utf-8'))}
    } catch(e) {
    }

    before(async () => {

        try {
            await blockchainConnection.unlockAccounts(organizationHost)
        } catch(e) {
        }

  /*      osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-v2/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-v2/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        data.OS_COLLECTION_ID = (await mainInterface.methods.item(data.OS_ID).call()).collectionId;
        data.OS_PROJECTION = (await mainInterface.methods.collection(data.OS_COLLECTION_ID).call()).host;

        data.DYNAMIC_URI_RESOLVER = await mainInterface.methods.dynamicUriResolver().call();
        data.ITEM_PROJECTION_FACTORY = await mainInterface.methods.hostInitializer().call();

        var MultiOperatorHost = await compile('../node_modules/@ethereansos/items-v2/contracts/projection/multiOperatorHost/impl/MultiOperatorHost')
        var multiOperatorHost = new web3.eth.Contract(MultiOperatorHost.abi, data.OS_PROJECTION);

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)
        var osMinter = await organization.methods.get("0x4668877ff569021c2e8188be2e797f8aa73265eac3479789edfd2531e130b1a1").call()

        await multiOperatorHost.methods.setOperator(1, osMinter).send(blockchainConnection.getSendingOptions({from : organizationHost}))
*/
        //await instrumentInvestmentsManager();
    })

    async function buy(test) {
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        var investmentsManagerAddress = await organization.methods.get("0x4f3ad97a91794a00945c0ead3983f793d34044c6300048d8b4ef95636edd234b").call()
        var InvestmentsManager = await compile('ext/investmentsManager/impl/InvestmentsManager')
        var investmentsManager = new web3.eth.Contract(InvestmentsManager.abi, investmentsManagerAddress);

        var tokens = [
            commonData.OS_ADDRESS,
            commonData.OS_ADDRESS,
            commonData.OS_ADDRESS,
            commonData.OS_ADDRESS
        ]

        investmentsManager.methods.setTokensFromETH(tokens).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))

        await web3.eth.sendTransaction({
            from : accounts[0],
            to : investmentsManagerAddress,
            value : 6 * 1e18
        })

        var prestoOperations = tokens.map(it => ({
            inputTokenAddress : utilities.voidEthereumAddress,
            inputTokenAmount : 0,
            ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            liquidityPoolAddresses : [
                "0x537D7928Cbf601275eCc67AaB6d544B25eD0938b"
            ],
            swapPath : [
                utilities.voidEthereumAddress
            ],
            enterInETH : false,
            exitInETH : false,
            tokenMins : [1],
            receivers : [],
            receiversPercentages : []
        }))

        await investmentsManager.methods.swapFromETH(prestoOperations, prestoOperations[0], accounts[9]).send(blockchainConnection.getSendingOptions())

        if(!test) {
            return
        }

        await catchCall(investmentsManager.methods.swapFromETH(prestoOperations, prestoOperations[0], accounts[9]), "no eth")

        await web3.eth.sendTransaction({
            from : accounts[0],
            to : investmentsManagerAddress,
            value : 6 * 1e18
        })

        await investmentsManager.methods.swapFromETH(prestoOperations, prestoOperations[0], accounts[9]).send(blockchainConnection.getSendingOptions())
        await catchCall(investmentsManager.methods.swapFromETH(prestoOperations, prestoOperations[0], accounts[9]), "no eth")
    }

    it("Buy", async () => {
        await buy(true);
    });

    it("Sell", async () => {
        await buy();

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        var investmentsManagerAddress = await organization.methods.get("0x4f3ad97a91794a00945c0ead3983f793d34044c6300048d8b4ef95636edd234b").call()
        var InvestmentsManager = await compile('ext/investmentsManager/impl/InvestmentsManager')
        var investmentsManager = new web3.eth.Contract(InvestmentsManager.abi, investmentsManagerAddress);

        var tokens = [
            commonData.OS_ADDRESS,
            commonData.OS_ADDRESS,
            commonData.OS_ADDRESS,
            commonData.OS_ADDRESS,
            commonData.OS_ADDRESS
        ]

        var percentages = tokens.map(() => utilities.numberToString(2 * 1e16))

        investmentsManager.methods.setTokensToETH(tokens, percentages).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))

        var prestoOperations = tokens.map(it => ({
            inputTokenAddress : utilities.voidEthereumAddress,
            inputTokenAmount : 0,
            ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            liquidityPoolAddresses : [
                "0x537D7928Cbf601275eCc67AaB6d544B25eD0938b"
            ],
            swapPath : [
                utilities.voidEthereumAddress
            ],
            enterInETH : false,
            exitInETH : false,
            tokenMins : [1],
            receivers : [],
            receiversPercentages : []
        }))

        await investmentsManager.methods.swapToETH(prestoOperations, utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        await catchCall(investmentsManager.methods.swapToETH(prestoOperations, utilities.voidEthereumAddress), "too early")

        await blockchainConnection.fastForward(commonData.WEEK_IN_BLOCKS)

        await investmentsManager.methods.swapToETH(prestoOperations, utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())
        await catchCall(investmentsManager.methods.swapToETH(prestoOperations, utilities.voidEthereumAddress), "too early")
    });

    async function attachFakeFarmingContract() {
        var code = `pragma solidity ^0.8.0;
contract FakeFarming {
}`

        var Contract = await compile(code, 'FakeFarming')
        var contract = await deployContract(new web3.eth.Contract(Contract.abi), Contract.bin)

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        await organization.methods.set({
            location : contract.options.address,
            key : "0x8ec6626208f22327b5df97db347dd390d4bbb54909af6bc9e8b044839ff9c2ef",
            active : false,
            log : true
        }).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))
    }

    async function instrumentInvestmentsManager() {

        var PrestoAddress = await compile('../node_modules/@ethereansos/covenants/contracts/presto/PrestoUniV3');
        var contract = await deployContract(new web3.eth.Contract(PrestoAddress.abi), PrestoAddress.bin, [utilities.voidEthereumAddress, commonData.executorRewardPercentage, commonData.AMM_AGGREGATOR, commonData.WETH_ADDRESS], {from : commonData.from});

        commonData.PRESTO_ADDRESS = contract.options.address;

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        var investmentsManagerAddress = await organization.methods.get("0x4f3ad97a91794a00945c0ead3983f793d34044c6300048d8b4ef95636edd234b").call()
        var InvestmentsManager = await compile('ext/investmentsManager/impl/InvestmentsManager')
        var investmentsManager = new web3.eth.Contract(InvestmentsManager.abi);

        var tokens = [commonData.OS_ADDRESS, commonData.OS_ADDRESS, commonData.OS_ADDRESS, commonData.OS_ADDRESS, commonData.OS_ADDRESS]
        var toETH = web3.eth.abi.encodeParameters(["uint256", "uint256", "address[]", "uint256[]"],
        [
            0,
            commonData.WEEK_IN_BLOCKS,
            tokens,
            tokens.map(() => utilities.numberToString(2 * 1e16)),
        ])

        tokens = [commonData.OS_ADDRESS, commonData.OS_ADDRESS, commonData.OS_ADDRESS, commonData.OS_ADDRESS]
        var fromETH = web3.eth.abi.encodeParameters(["address", "address[]"],
        [
            commonData.OS_ADDRESS,
            tokens
        ])

        var initData = web3.eth.abi.encodeParameters(["bytes32", "uint256", "address", "bytes", "bytes"], [
            "0x87a92f6bd20613c184485be8eadb46851dd4294a8359f902606085b8be6e7ae6",
            commonData.executorRewardPercentage,
            commonData.PRESTO_ADDRESS,
            fromETH,
            toETH
        ])

        initData = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.ourSubDAO, initData])

        investmentsManager = await deployContract(investmentsManager, InvestmentsManager.bin, [initData])

        var investmentsManagerAddress = investmentsManager.options.address;

        await organization.methods.set({
            location : investmentsManagerAddress,
            key : "0x4f3ad97a91794a00945c0ead3983f793d34044c6300048d8b4ef95636edd234b",
            active : false,
            log : true
        }).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))

    }

    async function changeDailyInflation(value) {
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        var OSFixedInflationManager = await compile('ethereans/osFixedInflationManager/impl/OSFixedInflationManager')
        var oSFixedInlfationAddress = await organization.methods.get("0x9c4db151be7222e332a1dcdb260c7b85b81f214f6b6d83d96c94f814d48a75a5").call()
        var oSFixedInflation = new web3.eth.Contract(OSFixedInflationManager.abi, oSFixedInlfationAddress);

        await oSFixedInflation.methods.updateTokenPercentage(value).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))
    }
})