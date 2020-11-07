// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;
pragma abicoder v2;

import "../../../core/model/IOrganization.sol";
import "./ETHOSFactory.sol";
import { Grimoire as BaseGrimoire } from  "../../../base/lib/KnowledgeBase.sol";

contract MultisigFactory is ETHOSFactory {
    using ReflectionUtilities for address;

    address[] private _utilityModels;

    constructor(bytes memory lazyInitData) ETHOSFactory(lazyInitData) {
    }

    function _factoryLazyInit(bytes memory lazyInitData) internal override returns (bytes memory) {
        (_utilityModels) = abi.decode(lazyInitData, (address[]));
        return "";
    }

    function deploy(bytes calldata deployData) external payable override virtual returns(address productAddress, bytes memory productInitResponse) {
        deployer[productAddress = modelAddress.clone()] = msg.sender;

        (string memory uri, bytes[] memory deployDatas) = abi.decode(deployData, (string, bytes[]));

        IOrganization.Component[] memory components = new IOrganization.Component[](1);

        components[0] = _createOrganizationComponent(_utilityModels[0], productAddress, deployDatas[0], BaseGrimoire.COMPONENT_KEY_TREASURY_MANAGER, false);

        (address[] memory addresses, uint256 minimumSignatures) = abi.decode(deployDatas[1], (address[], uint256));

        emit Deployed(modelAddress, productAddress, msg.sender, productInitResponse = ILazyInitCapableElement(productAddress).lazyInit(abi.encode(address(0), abi.encode(uri, dynamicUriResolver, abi.encode(addresses, minimumSignatures, abi.encode(components))))));

        require(ILazyInitCapableElement(productAddress).initializer() == address(this));
    }

    function _createOrganizationComponent(address modelAddress, address productAddress, bytes memory lazyInitData, bytes32 key, bool active) private returns(IOrganization.Component memory organizationComponent) {
        ILazyInitCapableElement((organizationComponent = IOrganization.Component(key, modelAddress.clone(), active, true)).location).lazyInit(abi.encode(productAddress, lazyInitData));
    }
}