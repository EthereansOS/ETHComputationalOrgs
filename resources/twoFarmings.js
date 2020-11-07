async function createFarming(commonData, rewardTokenAddress, rebalanceInterval, minStake) {
    var Factory = await compile('../node_modules/@ethereansos/swissknife/contracts/factory/model/IFactory')
    var factory = new web3.eth.Contract(Factory.abi, commonData.FARMING_FACTORY)

    var ModelBasedFarmingManager = await compile('ext/modelBasedFarmingManager/impl/ModelBasedFarmingManager')
    var modelBasedFarmingManager = new web3.eth.Contract(ModelBasedFarmingManager.abi)

    modelBasedFarmingManager = await deployContract(modelBasedFarmingManager, ModelBasedFarmingManager.bin, ["0x"], {from : commonData.from})

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

    initData = web3.eth.abi.encodeParameters(["address", "bytes"], [commonData.ourSubDAO, initData])

    var deployData = modelBasedFarmingManager.methods.lazyInit(initData).encodeABI()

    var lazyInitData = web3.eth.abi.encodeParameters(["address", "bytes", "address", "bytes"], [
        modelBasedFarmingManager.options.address,
        deployData,
        rewardTokenAddress,
        "0x"
    ])

    await blockchainCall(factory.methods.deploy, lazyInitData, {from : commonData.from})

    return modelBasedFarmingManager.options.address;
}

module.exports = async function deploy(commonData) {

    console.log("Create OS Farming Extension and Contract")
    commonData.OS_FARMING = await createFarming(commonData, commonData.OS_ADDRESS, commonData.THREE_MONTHS_IN_BLOCKS)
    console.log(" -> ", commonData.OS_FARMING)

    console.log("Create Dividends Farming Extension and Contract")
    commonData.DIVIDENDS_FARMING = await createFarming(commonData, utilities.voidEthereumAddress, 0, utilities.numberToString(5000*1e18))
    console.log(" -> ", commonData.DIVIDENDS_FARMING)

    return commonData;
}