// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface IStateHolder {

    struct InputVar {
        string name;
        string dataType;
        bytes value;
    }

    // Set funcs
    function batchSetVal(InputVar[] calldata variables) external returns(bytes[] memory);
    // Clear funcs
    function clear(string calldata varName) external returns(string memory oldDataType, bytes memory oldVal);
    function batchClear(uint256[] calldata varIndexes) external; 
    // Getters and setters
    function getProxy() external view returns (address);
    function setProxy() external;
    function getBytes(string calldata varName) external view returns(bytes memory);
    function setBytes(string calldata varName, bytes calldata val) external returns(bytes memory);
    function getString(string calldata varName) external view returns (string memory);
    function setString(string calldata varName, string calldata val) external returns(string memory);
    function getBool(string calldata varName) external view returns (bool);
    function setBool(string calldata varName, bool val) external returns(bool);
    function getUint256(string calldata varName) external view returns (uint256);
    function setUint256(string calldata varName, uint256 val) external returns(uint256);
    function getAddress(string calldata varName) external view returns (address);
    function setAddress(string calldata varName, address val) external returns (address);
    // Only getters
    function getStateSize() external view returns (uint256);
    function exists(string calldata varName) external view returns(bool);
    // Serializers
    function toJSON() external view returns(string memory);
    function toJSON(uint256 start, uint256 l) external view returns(string memory);
    
}