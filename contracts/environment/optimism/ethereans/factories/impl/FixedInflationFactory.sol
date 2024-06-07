// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../../../../ethereans/factories/impl/EthereansFactory.sol";

contract FixedInflationFactory is EthereansFactory {
    using ReflectionUtilities for address;

    address public uniswapV3SwapRouterAddress;
    address public defaultExtension;

    constructor(bytes memory lazyInitData) EthereansFactory(lazyInitData) {
    }

    function _ethosFactoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        (defaultExtension, uniswapV3SwapRouterAddress) = abi.decode(lazyInitData, (address, address));
        return "";
    }

    function cloneDefaultExtension() public returns (address clonedAddress) {
        (clonedAddress,) = Creator.create(abi.encodePacked(defaultExtension));
    }

    function deploy(bytes calldata deployData) external payable override returns(address deployedAddress, bytes memory deployedLazyInitResponse) {
        (deployedAddress,) = Creator.create(abi.encodePacked(modelAddress));
        deployer[deployedAddress] = msg.sender;
        (address extension, bytes memory initData) = abi.decode(deployData, (address, bytes));
        if(extension == address(0)) {
            extension = cloneDefaultExtension();
        }
        emit Deployed(modelAddress, deployedAddress, msg.sender, deployedLazyInitResponse = ILazyInitCapableElement(deployedAddress).lazyInit(abi.encode(uniswapV3SwapRouterAddress, extension, initData)));
        require(ILazyInitCapableElement(deployedAddress).initializer() == address(this));
    }
}