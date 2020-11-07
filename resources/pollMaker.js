module.exports = async function deploy(commonData) {

    console.log("Creating PollMaker");

    var uri = "ipfs://ipfs/QmbFYSX77V9YkAwkUTaooZcG9tWN6eKp5tRTQiPHLd1eYi";
    deployData = web3.eth.abi.encodeParameters(["uint256", "address"], [commonData.presetValues, commonData.models.ProposalsManager]);
    deployData = web3.eth.abi.encodeParameters(["string", "address", "bytes"], [uri, commonData.DYNAMIC_URI_RESOLVER, deployData]);
    deployData = web3.eth.abi.encodeParameters(["address", "bytes"], [utilities.voidEthereumAddress, deployData]);

    var PollMaker = await compile('ext/poll/impl/PollMaker');
    var pollMaker = await deployContract(new web3.eth.Contract(PollMaker.abi), PollMaker.bin, [deployData], {from : commonData.from});

    commonData.pollMaker = pollMaker.options.address;

    console.log(" -> ", pollMaker.options.address);

    return commonData;
}