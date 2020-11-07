// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "../contracts/core/model/IOrganization.sol";
import "../contracts/base/model/IStateManager.sol";
import { State, Getters } from "../contracts/base/lib/KnowledgeBase.sol";

contract UtilityOrganizationComponent is LazyInitCapableElement {
    using Getters for IOrganization;
    using State for IStateManager;

    bytes32 public constant KEY = keccak256("utility");

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
    }

    function setAddress(string memory name, address val) external authorizedOnly returns(address oldValue) {
        return IOrganization(host).stateManager().setAddress(name, val);
    }

    function setAddressArray(string memory name, address[] memory val) external authorizedOnly returns(address[] memory oldValue) {
        return IOrganization(host).stateManager().setAddressArray(name, val);
    }

    function setBool(string memory name, bool val) external authorizedOnly returns(bool oldValue) {
        return IOrganization(host).stateManager().setBool(name, val);
    }

    function setBoolArray(string memory name, bool[] memory val) external authorizedOnly returns(bool[] memory oldValue) {
        return IOrganization(host).stateManager().setBoolArray(name, val);
    }

    function setBytes(string memory name, bytes memory val) external authorizedOnly returns(bytes memory oldValue) {
        return IOrganization(host).stateManager().setBytes(name, val);
    }

    function setBytesArray(string memory name, bytes[] memory val) external authorizedOnly returns(bytes[] memory oldValue) {
        return IOrganization(host).stateManager().setBytesArray(name, val);
    }

    function setString(string memory name, string memory val) external authorizedOnly returns(string memory oldValue) {
        return IOrganization(host).stateManager().setString(name, val);
    }

    function setStringArray(string memory name, string[] memory val) external authorizedOnly returns(string[] memory oldValue) {
        return IOrganization(host).stateManager().setStringArray(name, val);
    }

    function setUint256(string memory name, uint256 val) external authorizedOnly returns(uint256 oldValue) {
        return IOrganization(host).stateManager().setUint256(name, val);
    }

    function setUint256Array(string memory name, uint256[] memory val) external authorizedOnly returns(uint256[] memory oldValue) {
        return IOrganization(host).stateManager().setUint256Array(name, val);
    }

    function getAddress(string memory name) external view returns(address oldValue) {
        return IOrganization(host).stateManager().getAddress(name);
    }

    function getAddressArray(string memory name) external view returns(address[] memory oldValue) {
        return IOrganization(host).stateManager().getAddressArray(name);
    }

    function getBool(string memory name) external view returns(bool oldValue) {
        return IOrganization(host).stateManager().getBool(name);
    }

    function getBoolArray(string memory name) external view returns(bool[] memory oldValue) {
        return IOrganization(host).stateManager().getBoolArray(name);
    }

    function getBytes(string memory name) external view returns(bytes memory oldValue) {
        return IOrganization(host).stateManager().getBytes(name);
    }

    function getBytesArray(string memory name) external view returns(bytes[] memory oldValue) {
        return IOrganization(host).stateManager().getBytesArray(name);
    }

    function getString(string memory name) external view returns(string memory oldValue) {
        return IOrganization(host).stateManager().getString(name);
    }

    function getStringArray(string memory name) external view returns(string[] memory oldValue) {
        return IOrganization(host).stateManager().getStringArray(name);
    }

    function getUint256(string memory name) external view returns(uint256 oldValue) {
        return IOrganization(host).stateManager().getUint256(name);
    }

    function getUint256Array(string memory name) external view returns(uint256[] memory oldValue) {
        return IOrganization(host).stateManager().getUint256Array(name);
    }
}