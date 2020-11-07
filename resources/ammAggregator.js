var fs = require('fs');
var path = require('path');

var code = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@ethereansos/covenants/contracts/amm-aggregator/aggregator/AMMAggregator.sol";
import "@ethereansos/covenants/contracts/amm-aggregator/models/UniswapV2/1/UniswapV2AMMV1.sol";

contract Contract {
    event Amm(address indexed, address indexed);

    constructor() {
        UniswapV2AMMV1 amm = new UniswapV2AMMV1(${web3.utils.toChecksumAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D")});
        address[] memory amms = new address[](1);
        amms[0] = address(amm);
        AMMAggregator aggregator = new AMMAggregator(address(this), amms);
        emit Amm(address(amm), address(aggregator));
    }
}`;

module.exports = async function deploy(commonData) {
    var location = path.resolve(__dirname, '../contracts/Contract.sol');

    try {
        fs.unlinkSync(location);
    } catch(e) {
    }

    fs.writeFileSync(location, code);

    var Contract = await compile('Contract');
    await deployContract(new web3.eth.Contract(Contract.abi), Contract.bin, undefined, {from : commonData.from});

    try {
        fs.unlinkSync(location);
    } catch(e) {
    }

    return commonData;
}