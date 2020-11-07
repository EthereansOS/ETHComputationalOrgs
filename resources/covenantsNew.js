module.exports = async function deploy(commonData) {

    console.log("Deploying Presto UniV3");

    var PrestoAddress = await compile('../node_modules/@ethereansos/covenants/contracts/presto/PrestoUniV3');
    var contract = await deployContract(new web3.eth.Contract(PrestoAddress.abi), PrestoAddress.bin, [utilities.voidEthereumAddress, commonData.executorRewardPercentage, commonData.AMM_AGGREGATOR, commonData.WETH_ADDRESS], {from : commonData.from});

    commonData.PRESTO_ADDRESS = contract.options.address;
    console.log(" -> ", commonData.PRESTO_ADDRESS);

    return commonData;
}