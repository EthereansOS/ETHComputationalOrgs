// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../ProposalData.sol";

interface IMVDProxy {

    function init(address doubleProxyAddress) external;
    function setProxies(address functionalityProposalManagerAddress, address stateHolderAddress, address functionalitiesManagerAddress, address walletAddress) external;
    function getDelegates() external view returns(address[] memory);
    function getItemCollection() external view returns(address);
    function getMVDFunctionalityProposalManagerAddress() external view returns(address);
    function getStateHolderAddress() external view returns(address);
    function getMVDFunctionalityModelsManagerAddress() external view returns(address);
    function getMVDFunctionalitiesManagerAddress() external view returns(address);
    function getEthItemOrchestratorAddress() external view returns(address);
    function getMVDWalletAddress() external view returns(address);
    function getDoubleProxyAddress() external view returns(address);
    function isValidProposal(address proposal) external view returns (bool);
    function isAuthorizedFunctionality(address functionality) external view returns(bool);
    function newProposal(ProposalData calldata proposalData) external returns(address proposalAddress);
    function startProposal(address proposalAddress) external;
    function disableProposal(address proposalAddress) external;
    function transfer(address receiver, uint256 value, address token) external;
    function flushToWallet(address tokenAddress, bool is721, uint256 tokenId) external;
    function setProposal() external;
    function read(string calldata codeName, bytes calldata data) external view returns(bytes memory returnData);
    function submit(string calldata codeName, bytes calldata data) external payable returns(bytes memory returnData);
    function callFromManager(address location, bytes calldata payload) external returns(bool, bytes memory);
    function emitFromManager(string calldata codeName, address proposal, string calldata replaced, address replacedSourceLocation, uint256 replacedSourceLocationId, address location, bool submitable, string calldata methodSignature, bool isInternal, bool needsSender, address proposalAddress) external;

    function emitEvent(string calldata eventSignature, bytes calldata firstIndex, bytes calldata secondIndex, bytes calldata data) external;

    event Proposal(address proposal);
    event ProposalCheck(address indexed proposal);
    event ProposalSet(address indexed proposal, bool success);
    event FunctionalitySet(string codeName, address indexed proposal, string replaced, address replacedSourceLocation, uint256 replacedSourceLocationId, address indexed replacedLocation, bool replacedWasSubmitable, string replacedMethodSignature, bool replacedWasInternal, bool replacedNeededSender, address indexed replacedProposal);

    event Event(string indexed key, bytes32 indexed firstIndex, bytes32 indexed secondIndex, bytes data);
}