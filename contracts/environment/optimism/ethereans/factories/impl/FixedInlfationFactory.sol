// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../../../../ethereans/factories/impl/EthereansFactory.sol";

contract FixedInlfationFactory is EthereansFactory {
    using ReflectionUtilities for address;

    address public defaultExtension;

    constructor(bytes memory lazyInitData) EthereansFactory(lazyInitData) {
    }

    function _ethosFactoryLazyInit(bytes memory lazyInitData) internal override returns(bytes memory) {
        (defaultExtension) = abi.decode(lazyInitData, (address));
        return "";
    }

    function cloneDefaultExtension() external returns (address clonedAddress) {
        (clonedAddress,) = Creator.create(abi.encodePacked(defaultExtension));
    }

    function deploy(bytes calldata deployData) external payable override returns(address deployedAddress, bytes memory deployedLazyInitResponse) {
        (deployedAddress,) = Creator.create(abi.encodePacked(modelAddress));
        deployer[deployedAddress] = msg.sender;
        emit Deployed(modelAddress, deployedAddress, msg.sender, deployedLazyInitResponse = ILazyInitCapableElement(deployedAddress).lazyInit(deployData));
        require(ILazyInitCapableElement(deployedAddress).initializer() == address(this));
    }
}