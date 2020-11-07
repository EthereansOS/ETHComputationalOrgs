var uniswapCode = `pragma solidity >=0.7.5;

interface Quoter {
    function quoteExactInput(
        bytes calldata path,
        uint256 amountIn
    ) external returns (uint256 amountOut);
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}`

var conversionEncode = {
    "100": "000064",
    "500" : "0001f4",
    "3000" : "000bb8",
    "10000": "002710"
}

async function calculatePriceWithSlippage(liquidityPoolAddress, fromToken, quoterAddress, value) {
    fromToken = web3.utils.toChecksumAddress(fromToken);
    var Pool = await compile(uniswapCode, "IUniswapV3Pool");
    var pool = new web3.eth.Contract(Pool.abi, liquidityPoolAddress);

    var token0 = await pool.methods.token0().call();
    var token1 = await pool.methods.token1().call();
    var fee = await pool.methods.fee().call();

    var otherToken = fromToken === token0 ? token1 : token0;

    var Quoter = await compile(uniswapCode, "Quoter");
    var quoter = new web3.eth.Contract(Quoter.abi, quoterAddress);

    var path = fromToken + conversionEncode[fee] + otherToken.substring(2)

    var output = await quoter.methods.quoteExactInput(
        path,
        value).call()

    output = utilities.numberToString(parseInt(output) * 0.97).split('.')[0]

    return output;
}

module.exports = async function call(commonData) {
    var Organization = await compile('ext/subdao/impl/SubDAO')
    var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
    var fixedInflationManagerAddress = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_TOKEN_MINTER_AUTH).call()
    var FixedInflationManager = await compile('ethereans/osFixedInflationManager/impl/OSFixedInflationManager')
    var fixedInflationManager = new web3.eth.Contract(FixedInflationManager.abi, fixedInflationManagerAddress);

    /*await blockchainCall(fixedInflationManager.methods.setDestination, "0xe3acF319031A2379c58537a7Fe3E9d9EEBA93b72", "0x25756f9C2cCeaCd787260b001F224159aB9fB97A", {from : commonData.from})

    if(web3.currentProvider.blockchainConnection) {
        await catchCall(blockchainCall(fixedInflationManager.methods.setDestination, "0xe3acF319031A2379c58537a7Fe3E9d9EEBA93b72", "0x25756f9C2cCeaCd787260b001F224159aB9fB97A", {from : commonData.from}))
        try {
            blockchainConnection.unlockAccounts("0xe3acF319031A2379c58537a7Fe3E9d9EEBA93b72")
        } catch(e) {
        }
        await blockchainCall(fixedInflationManager.methods.setDestination, "0xe3acF319031A2379c58537a7Fe3E9d9EEBA93b72", "0x25756f9C2cCeaCd787260b001F224159aB9fB97A", {from : "0xe3acF319031A2379c58537a7Fe3E9d9EEBA93b72"})
    }*/

    //await blockchainCall(fixedInflationManager.methods.updateInflationData, {from : commonData.from})

    var value = await fixedInflationManager.methods.lastInflationPerDay().call();
    var tokenReceiverPercentage = await fixedInflationManager.methods.tokenReceiverPercentage().call()

    tokenReceiverPercentage = 1 - parseFloat(utilities.fromDecimals(tokenReceiverPercentage, 18, true))

    value = utilities.numberToString(parseInt(value) * tokenReceiverPercentage).split('.')[0]

    var slippage = await calculatePriceWithSlippage(commonData.OS_ETH_LP, commonData.OS_ADDRESS, commonData.UNISWAP_V3_QUOTER_ADDRESS, value)

    var osOperation = {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            "0xccc42cf5d6a2f3ed8f948541455950ed6ce14707"
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [slippage],
        receivers : [],
        receiversPercentages : []
    }

    var receiver = "0x1E6E94097782B976a20ba5B8d4454e26378457A7"

    await blockchainCall(fixedInflationManager.methods.swapToETH, osOperation, receiver, {from : commonData.from})

    if(web3.currentProvider.blockchainConnection) {
        await catchCall(blockchainCall(fixedInflationManager.methods.swapToETH, osOperation, receiver, {from : commonData.from}), 'too early')
    }

    return commonData
}