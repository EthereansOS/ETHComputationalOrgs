var sendBlockchainTransaction = require('../util/sendBlockchainTransaction')

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

    balance = await web3.eth.getBalance(investmentsManager.options.address);

    var amount = 0;
    while(true) {
        var total = balance.add(amount);
        var fee = total.mul(5).div(100);
        total = total.sub(fee);
        var bn = web3.utils.toBN(total);
        var mod = bn.mod(web3.utils.toBN(5));
        mod = parseInt(mod.toString());
        if(mod === 0) {
            break;
        }
        amount++;
    }
    if(amount > 0) {
        amount = utilities.numberToString(amount);
        await sendBlockchainTransaction(web3.currentProvider, commonData.from, investmentsManager.options.address, "0x", amount);
        balance = await web3.eth.getBalance(investmentsManager.options.address);
    }

    /*var cost = utilities.fromDecimals(balance, 18, true).split('.');
    if(cost.length > 1 && parseInt(cost[1]) > 0) {
        cost = cost[1];
        var zeroes = 0;
        for(zeroes; zeroes < cost.length; zeroes++) {
            if(cost[zeroes] !== '0') {
                break;
            }
        }
        var prefix = cost.substring(0, zeroes);
        cost = cost.substring(zeroes);
        var unity = "";
        for(var i = 0; i < cost.length; i++) {
            unity += "0";
        }
        cost = ("1" + unity).sub(cost);
        cost = "0." + prefix + cost;
        cost = utilities.toDecimals(cost, 18);
        cost = cost.mul(100).div(95);
        cost = cost.split('.')[0];
        await sendBlockchainTransaction(web3.currentProvider, commonData.from, investmentsManager.options.address, "0x", cost);
        balance = await web3.eth.getBalance(investmentsManager.options.address);
        fee = balance.mul(5).div(100);
        balance = balance.sub(fee);
    }*/

    var fee = balance.mul(5).div(100);
    balance = balance.sub(fee);

    balance = balance.div(5).split('.')[0];

    var prestoOperations = [{
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            "0x92560C178cE069CC014138eD3C2F5221Ba71f58a"
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [1],
        receivers : [],
        receiversPercentages : []
    }, {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            "0x06B1655b9D560de112759b4F0Bf57d6F005e72Fe"
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [1],
        receivers : [],
        receiversPercentages : []
    }, {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            "0x9359c87B38DD25192c5f2b07b351ac91C90E6ca7"
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [1],
        receivers : [],
        receiversPercentages : []
    }, {
        inputTokenAddress : utilities.voidEthereumAddress,
        inputTokenAmount : 0,
        ammPlugin : "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        liquidityPoolAddresses : [
            "0x06aDA8f74D99C6C200672b02E5C3341866cA3bFB"
        ],
        swapPath : [
            utilities.voidEthereumAddress
        ],
        enterInETH : false,
        exitInETH : false,
        tokenMins : [1],
        receivers : [],
        receiversPercentages : []
    }]

    var slippages = await Promise.all(prestoOperations.map(it => calculatePriceWithSlippage(it.liquidityPoolAddresses[0], commonData.WETH_ADDRESS, commonData.UNISWAP_V3_QUOTER_ADDRESS, balance)))
    prestoOperations = prestoOperations.map((it, i) => ({...it, tokenMins : [slippages[i]]}));

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
        tokenMins : [await calculatePriceWithSlippage("0xccc42cf5d6a2f3ed8f948541455950ed6ce14707", commonData.WETH_ADDRESS, commonData.UNISWAP_V3_QUOTER_ADDRESS, balance)],
        receivers : [],
        receiversPercentages : []
    }

    var other = "0x5a7C65C2198128F685720C742f52FaBbb290CF10"

    await blockchainCall(investmentsManager.methods.swapFromETH, prestoOperations, osOperation, other, {from : commonData.from})

    return commonData
}