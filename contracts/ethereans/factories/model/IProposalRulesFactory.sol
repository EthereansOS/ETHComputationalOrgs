//SPDX-License-Identifier: MIT

pragma solidity >=0.7.0;
pragma abicoder v2;

import "@ethereansos/swissknife/contracts/factory/impl/Factory.sol";

interface IProposalRulesFactory is IFactory {

    event DeployResult(address[], bytes[]);

    event Model(address indexed modelAddress, bool indexed singleton, uint256 indexed positionIndex);

    function list() external view returns(address[] memory modelAddresses, bool[] memory singletons, bool[] memory deprecated);

    function subList(uint256[] calldata modelIndices) external view returns(address[] memory modelAddresses, bool[] memory singletons, bool[] memory deprecated);

    function get(uint256 modelIndex) external view returns(address modelAddress, bool singleton, bool deprecated);

    function validateInputs(uint256[] calldata modelIndices, bytes[] calldata inputData) external view returns(bool[] memory results);

    function add(bytes[] calldata addressesOrCodes, bool[] calldata singletons) external returns(address[] memory modelAddresses, uint256[] memory positionIndices);

    function deprecate(uint256[] calldata modelIndices) external;

    function indexOf(address modelAddress) external view returns(uint256 i);

    function bySalt(address dataCollector) external view returns(address productAddress, bytes32 salt, bytes memory bytecode, uint256 index, address modelAddress, bool singleton, bool deprecated);

    function bySalt(uint256 modelIndex, bytes32 initialSalt) external view returns(address dataCollector, address productAddress, bytes32 salt, bytes memory bytecode, uint256 index, address modelAddress, bool singleton, bool deprecated);
}