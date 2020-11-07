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
    var investmentsManagerAddress = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_INVESTMENTS_MANAGER).call()
    var InvestmentsManager = await compile('ext/investmentsManager/impl/InvestmentsManager')
    var investmentsManager = new web3.eth.Contract(InvestmentsManager.abi, investmentsManagerAddress);

    var treasurySplitterAddress = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_TREASURY_SPLITTER_MANAGER).call()

    var ERC20 = await compile('../node_modules/@openzeppelin/contracts/token/ERC20/IERC20')

    var tokens = await investmentsManager.methods.tokensToETH().call()

    var percentages = tokens[1].map(it => parseFloat(utilities.fromDecimals(it, 18, true)))
    tokens = tokens[0]

    var balances = await Promise.all(tokens.map(it => new web3.eth.Contract(ERC20.abi, it).methods.balanceOf(investmentsManagerAddress).call()));
    var values = balances.map((it, i) => utilities.numberToString(parseInt(it) * percentages[i]).split('.')[0])

    var liquidityPoolAddresses = [
        "0x92560C178cE069CC014138eD3C2F5221Ba71f58a",
        "0x06B1655b9D560de112759b4F0Bf57d6F005e72Fe",
        "0x9359c87B38DD25192c5f2b07b351ac91C90E6ca7",
        "0x06aDA8f74D99C6C200672b02E5C3341866cA3bFB",
        "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
    ];

    var slippages = await Promise.all(tokens.map((it, i) => calculatePriceWithSlippage(liquidityPoolAddresses[i], it === utilities.voidEthereumAddress ? commonData.WETH_ADDRESS : it, commonData.UNISWAP_V3_QUOTER_ADDRESS, values[i])))

    var prestoOperations = [{
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            liquidityPoolAddresses[0]
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [slippages[0]],
        receivers : [],
        receiversPercentages : []
    }, {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            liquidityPoolAddresses[1]
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [slippages[1]],
        receivers : [],
        receiversPercentages : []
    }, {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            liquidityPoolAddresses[2]
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [slippages[2]],
        receivers : [],
        receiversPercentages : []
    }, {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            liquidityPoolAddresses[3]
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [slippages[3]],
        receivers : [],
        receiversPercentages : []
    }, {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            liquidityPoolAddresses[4]
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [slippages[4]],
        receivers : [],
        receiversPercentages : []
    }]

    var receiver = "0x5a7C65C2198128F685720C742f52FaBbb290CF10"

    await blockchainCall(investmentsManager.methods.swapToETH, prestoOperations, receiver, {from : commonData.from})

    if(web3.currentProvider.blockchainConnection) {
        await catchCall(blockchainCall(investmentsManager.methods.swapToETH, prestoOperations, receiver, {from : commonData.from}), 'too early')
    }

    return commonData
}