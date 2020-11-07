var organizationHost = "0x06376e26A36f8917F9108D78c6eFaF05d5Cc66EB";

var rootAddress = "0xc9EbaD0f2D24Df4cD3617b374260c4CA28A3ae39";
var subDAOAddress = "0x4Adb504E458566aebe712DD549bcE5050D0c759c";
var delegationAddress = "0x95eab297b6a4A881ef70A2ebf5b80984EC264B3f";
var delegationFactory="0xeCaa0B4e3a5725b2E588229337ede9c324619f6d";
var farmingFactoryAddress = "0x1a2863AED7Dc4E99e77495F54D56cc9B6dc049F2";

var fs = require('fs')

describe("Farming Models Test", () => {

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
    })

    async function createFarming(rewardTokenAddress, rebalanceInterval, minStake) {
        var Factory = await compile('../node_modules/@ethereansos/swissknife/contracts/factory/model/IFactory')
        var factory = new web3.eth.Contract(Factory.abi, farmingFactoryAddress)

        var ModelBasedFarmingManager = await compile('ext/modelBasedFarmingManager/impl/ModelBasedFarmingManager')
        var modelBasedFarmingManager = new web3.eth.Contract(ModelBasedFarmingManager.abi)

        modelBasedFarmingManager = await deployContract(modelBasedFarmingManager, ModelBasedFarmingManager.bin, ["0x"])

/*    uint256 blockDuration; // duration of setup
    uint256 startBlock; // optional start block used for the delayed activation of the first setup
    uint256 originalRewardPerBlock;
    uint256 minStakeable; // minimum amount of staking tokens.
    uint256 renewTimes; // if the setup is renewable or if it's one time.
    address liquidityPoolTokenAddress; // address of the liquidity pool token
    address mainTokenAddress; // eg. buidl address.
    bool involvingETH; // if the setup involves ETH or not.
    uint256 setupsCount; // number of setups created by this info.
    uint256 lastSetupIndex; // index of last setup;
    int24 tickLower; // Gen2 Only - tickLower of the UniswapV3 pool
    int24 tickUpper; // Gen 2 Only - tickUpper of the UniswapV3 pool*/

        var modelTypes = [
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "address",
            "address",
            "bool",
            "uint256",
            "uint256",
            "int24",
            "int24"
        ];

        var models = [[
            commonData.THREE_MONTHS_IN_BLOCKS,
            0,
            0,
            minStake || 0,
            0,
            commonData.OS_ETH_LP,
            commonData.OS_ADDRESS,
            true,
            0,
            0,
            -145000,
            39200
        ]]

        var initData = abi.encode(["bytes32", "uint256", `tuple(${modelTypes.join(',')})[]`, "uint256[]", "uint256", "uint256"],
        [
            utilities.voidBytes32,
            commonData.executorRewardPercentage,
            models,
            [],
            0,
            rebalanceInterval
        ])

        initData = web3.eth.abi.encodeParameters(["address", "bytes"], [subDAOAddress, initData])

        var deployData = modelBasedFarmingManager.methods.lazyInit(initData).encodeABI()

        var lazyInitData = web3.eth.abi.encodeParameters(["address", "bytes", "address", "bytes"], [
            modelBasedFarmingManager.options.address,
            deployData,
            rewardTokenAddress,
            "0x"
        ])

        await blockchainCall(factory.methods.deploy, lazyInitData, {from : commonData.from})
        return modelBasedFarmingManager;
    }

    it("OS", async () => {
        //var farmingManager = await createFarming(commonData.OS_ADDRESS, commonData.THREE_MONTHS_IN_BLOCKS, 0)

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)

        var farmingManagerAddress = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_OS_FARMING).call()
        var ModelBasedFarmingManager = await compile('ext/modelBasedFarmingManager/impl/ModelBasedFarmingManager')
        var farmingManager = new web3.eth.Contract(ModelBasedFarmingManager.abi, farmingManagerAddress)

        await catchCall(farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress), "no balance")

        var ERC20 = await compile('../node_modules/@openzeppelin/contracts/token/ERC20/IERC20')
        var erc20 = new web3.eth.Contract(ERC20.abi, commonData.OS_ADDRESS);

        var value = utilities.numberToString(15*1e18)

        await erc20.methods.transfer(farmingManager.options.address, value).send(blockchainConnection.getSendingOptions({from  : organizationHost}))

        await farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        await catchCall(farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress), "too early")

        await blockchainConnection.fastForward(commonData.THREE_MONTHS_IN_BLOCKS)

        await catchCall(farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress), "no balance")

        await erc20.methods.transfer(farmingManager.options.address, value).send(blockchainConnection.getSendingOptions({from  : organizationHost}))

        await farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        console.log("Before activation", await farmingManager.methods.reservedBalance().call())
        var farmingAddress = await farmingManager.methods.data().call()
        farmingAddress = farmingAddress[0]

        var FarmMainRegularMinStake = await compile('../resources/FarmMainRegularMinStake', 'FarmMainRegularMinStake', '0.7.6');
        var farmMainRegularMinStake = new web3.eth.Contract(FarmMainRegularMinStake.abi, farmingAddress)

        await farmMainRegularMinStake.methods.activateSetup(1).send(blockchainConnection.getSendingOptions())

        console.log("After activation", await farmingManager.methods.reservedBalance().call())

        await catchCall(farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress), "too early")

        await blockchainConnection.fastForward(commonData.THREE_MONTHS_IN_BLOCKS)

        await erc20.methods.transfer(farmingManager.options.address, value.sub(3*1e18)).send(blockchainConnection.getSendingOptions({from  : organizationHost}))
        console.log("Before rebalance", await farmingManager.methods.reservedBalance().call())

        await farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())
        console.log("After rebalance", await farmingManager.methods.reservedBalance().call())
    });

    it("Dividends", async () => {
        //var farmingManager = await createFarming(utilities.voidEthereumAddress, 0, utilities.numberToString(5000*1e18))

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)

        var farmingManagerAddress = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_DIVIDENDS_FARMING).call()
        var ModelBasedFarmingManager = await compile('ext/modelBasedFarmingManager/impl/ModelBasedFarmingManager')
        var farmingManager = new web3.eth.Contract(ModelBasedFarmingManager.abi, farmingManagerAddress)

        await catchCall(farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress), "no balance")

        var value = utilities.numberToString(3*1e18)

        await web3.eth.sendTransaction({
            from : accounts[0],
            to : farmingManager.options.address,
            value
        })

        await farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        console.log("Before no balance", await farmingManager.methods.reservedBalance().call())

        await catchCall(farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress), "no balance")

        await web3.eth.sendTransaction({
            from : accounts[0],
            to : farmingManager.options.address,
            value
        })

        await farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())

        console.log("Before activation", await farmingManager.methods.reservedBalance().call())
        var farmingAddress = await farmingManager.methods.data().call()
        farmingAddress = farmingAddress[0]

        var FarmMainRegularMinStake = await compile('../resources/FarmMainRegularMinStake', 'FarmMainRegularMinStake', '0.7.6');
        var farmMainRegularMinStake = new web3.eth.Contract(FarmMainRegularMinStake.abi, farmingAddress)

        await farmMainRegularMinStake.methods.activateSetup(1).send(blockchainConnection.getSendingOptions())

        console.log("After activation", await farmingManager.methods.reservedBalance().call())

        await catchCall(farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress), "no balance")

        console.log("Before rebalance", await farmingManager.methods.reservedBalance().call())

        await web3.eth.sendTransaction({
            from : accounts[0],
            to : farmingManager.options.address,
            value
        })

        await farmingManager.methods.rebalanceRewardsPerBlock(utilities.voidEthereumAddress).send(blockchainConnection.getSendingOptions())
        console.log("After rebalance", await farmingManager.methods.reservedBalance().call())

        var Organization = await compile('ext/subdao/impl/SubDAO')
        var organization = new web3.eth.Contract(Organization.abi, subDAOAddress)
        var proposalsManagerAddress = await organization.methods.get("0xa504406933af7ca120d20b97dfc79ea9788beb3c4d3ac1ff9a2c292b2c28e0cc").call()
        try {
            await blockchainConnection.unlockAccounts(proposalsManagerAddress)
        } catch(e) {}

        await catchCall(farmingManager.methods.flushBackToTreasury([utilities.voidEthereumAddress]), "unauthorized")

        await farmingManager.methods.flushBackToTreasury([utilities.voidEthereumAddress]).send(blockchainConnection.getSendingOptions({from : proposalsManagerAddress}))
    });
})