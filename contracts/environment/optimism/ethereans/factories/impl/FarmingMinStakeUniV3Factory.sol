// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../../../../ethereans/factories/impl/EthereansFactory.sol";

contract FarmingMinStakeUniV3Factory is EthereansFactory {

    address public uniswapV3NonfungiblePositionManager;
    address public defaultExtension;

    event Extension(address indexed sender, address indexed extension);

    constructor(bytes memory lazyInitData) EthereansFactory(lazyInitData) {
    }

    function _ethosFactoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        (defaultExtension, uniswapV3NonfungiblePositionManager) = abi.decode(lazyInitData, (address, address));
        return "";
    }

    function cloneDefaultExtension() public returns (address clonedAddress) {
        (clonedAddress, ) = Creator.create(abi.encode(defaultExtension));
        emit Extension(msg.sender, clonedAddress);
    }

    function deploy(bytes calldata deployData) external payable override returns(address deployedAddress, bytes memory deployedLazyInitResponse) {
        (address extension, bytes memory initData) = abi.decode(deployData, (address, bytes));
        if(extension == address(0)) {
            extension = cloneDefaultExtension();
        }
        (deployedAddress, deployedLazyInitResponse,) = Initializer.create(abi.encode(modelAddress), abi.encode(uniswapV3NonfungiblePositionManager, extension, initData));
        deployer[deployedAddress] = msg.sender;
        emit Deployed(modelAddress, deployedAddress, msg.sender, deployedLazyInitResponse);
    }
}