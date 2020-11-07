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

    var treasurySplitterAddress = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_TREASURY_SPLITTER_MANAGER).call()
    var TreasurySplitter = await compile('ext/treasurySplitterManager/impl/TreasurySplitterManager')
    var treasurySplitter = new web3.eth.Contract(TreasurySplitter.abi, treasurySplitterAddress);

    await blockchainCall(treasurySplitter.methods.splitTreasury, commonData.fromAddress, {from : commonData.from})

    return commonData
}