module.exports = async function call(commonData) {
    var Organization = await compile('ext/subdao/impl/SubDAO')
    var organization = new web3.eth.Contract(Organization.abi, commonData.ourSubDAO)
    var investmentsManagerAddress = await organization.methods.get(commonData.grimoire.COMPONENT_KEY_INVESTMENTS_MANAGER).call()
    var InvestmentsManager = await compile('ext/investmentsManager/impl/InvestmentsManager')
    var investmentsManager = new web3.eth.Contract(InvestmentsManager.abi, investmentsManagerAddress);

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
        tokenMins : [1],
        receivers : [],
        receiversPercentages : []
    }

    await blockchainCall(investmentsManager.methods.swapFromETH, prestoOperations, osOperation, commonData.fromAddress, {from : commonData.from})

    return commonData
}