var organizationHost = "0x06376e26A36f8917F9108D78c6eFaF05d5Cc66EB";

var rootAddress = "0xc9EbaD0f2D24Df4cD3617b374260c4CA28A3ae39";
var subDAOAddress = "0x4Adb504E458566aebe712DD549bcE5050D0c759c";
var delegationAddress = "0x95eab297b6a4A881ef70A2ebf5b80984EC264B3f";
var delegationFactory="0xeCaa0B4e3a5725b2E588229337ede9c324619f6d";

var fs = require('fs')

describe("Inflation", () => {

    var data = {OS_ADDRESS : "0x20276BA44228370f18cD7a036a4bca1473B8b557"}
    var osAddress;
    var mainInterface;

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

        osAddress = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemInteroperableInterface')).abi, data.OS_ADDRESS);

        data.OS_ID = await osAddress.methods.itemId().call();
        data.ITEM_MAININTERFACE = await osAddress.methods.mainInterface().call();

        mainInterface = new web3.eth.Contract((await compile('../node_modules/@ethereansos/items-core/contracts/model/IItemMainInterface')).abi, data.ITEM_MAININTERFACE);

        data.OS_COLLECTION_ID = (await mainInterface.methods.item(data.OS_ID).call()).collectionId;
        data.OS_PROJECTION = (await mainInterface.methods.collection(data.OS_COLLECTION_ID).call()).host;

        data.DYNAMIC_URI_RESOLVER = await mainInterface.methods.dynamicUriResolver().call();
        data.ITEM_PROJECTION_FACTORY = await mainInterface.methods.hostInitializer().call();

        var MultiOperatorHost = await compile('../node_modules/@ethereansos/items-core/contracts/projection/multiOperatorHost/impl/MultiOperatorHost')
        var multiOperatorHost = new web3.eth.Contract(MultiOperatorHost.abi, data.OS_PROJECTION);

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)
        var osMinter = await organization.methods.get("0x4668877ff569021c2e8188be2e797f8aa73265eac3479789edfd2531e130b1a1").call()

        await multiOperatorHost.methods.setOperator(1, osMinter).send(blockchainConnection.getSendingOptions({from : organizationHost}))

        //await instrumentFixedInflation();

        //await attachFakeFarmingContract();
    })

    it("Give Mint Privileges", async () => {
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)

        var oSFixedInlfationAddress = await organization.methods.get("0x9c4db151be7222e332a1dcdb260c7b85b81f214f6b6d83d96c94f814d48a75a5").call()
        var OSFixedInflationManager = await compile('ethereans/osFixedInflationManager/impl/OSFixedInflationManager')
        var oSFixedInflation = new web3.eth.Contract(OSFixedInflationManager.abi, oSFixedInlfationAddress);

        var prestoOperation = {
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
        }

        await oSFixedInflation.methods.updateInflationData().send(blockchainConnection.getSendingOptions())

        await oSFixedInflation.methods.swapToETH(prestoOperation, utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        await catchCall(oSFixedInflation.methods.swapToETH(prestoOperation, utilities.voidEthereumAddress), "too early")

        await changeDailyInflation(utilities.numberToString(0.5 * 1e16))

        await blockchainConnection.fastForward(commonData.ONE_YEAR_IN_BLOCKS)

        await oSFixedInflation.methods.swapToETH(prestoOperation, utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        await catchCall(oSFixedInflation.methods.swapToETH(prestoOperation, utilities.voidEthereumAddress), "too early")

        await blockchainConnection.fastForward(commonData.DAY_IN_BLOCKS)

        await oSFixedInflation.methods.swapToETH(prestoOperation, utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

    });


    async function attachFakeFarmingContract() {
        var code = `pragma solidity ^0.8.0;
contract FakeFarming {
}`

        var Contract = await compile(code, 'FakeFarming')
        var contract = await deployContract(new web3.eth.Contract(Contract.abi), Contract.bin)

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)
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

    async function instrumentFixedInflation() {

        var PrestoAddress = await compile('../node_modules/@ethereansos/covenants-core/contracts/presto/PrestoUniV3');
        var contract = await deployContract(new web3.eth.Contract(PrestoAddress.abi), PrestoAddress.bin, [utilities.voidEthereumAddress, commonData.executorRewardPercentage, commonData.AMM_AGGREGATOR, commonData.WETH_ADDRESS], {from : commonData.from});

        commonData.PRESTO_ADDRESS = contract.options.address;

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        var OSFixedInflationManager = await compile('ethereans/osFixedInflationManager/impl/OSFixedInflationManager')
        var oSFixedInflation = new web3.eth.Contract(OSFixedInflationManager.abi);

        var osFixedInflationInitData = web3.eth.abi.encodeParameters(["bytes", "bytes", "bytes"],
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
        )

        osFixedInflationInitData = web3.eth.abi.encodeParameters(["address", "bytes"], [subDAOAddress, osFixedInflationInitData])

        oSFixedInflation = await deployContract(oSFixedInflation, OSFixedInflationManager.bin, [osFixedInflationInitData])

        var osFixedInflationManagerAddress = oSFixedInflation.options.address;

        await organization.methods.set({
            location : osFixedInflationManagerAddress,
            key : "0x9c4db151be7222e332a1dcdb260c7b85b81f214f6b6d83d96c94f814d48a75a5",
            active : false,
            log : true
        }).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))

    }

    async function changeDailyInflation(value) {
        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)
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