// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;

interface IMVDFunctionalityModelsManager {
    function init() external;
    function checkWellKnownFunctionalities(string calldata codeName, bool submitable, string calldata methodSignature, string calldata returnAbiParametersArray, bool isInternal, bool needsSender, string calldata replaces) external view;
}