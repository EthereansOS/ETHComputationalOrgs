// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../../base/model/IProposalsManager.sol";
import "../../subDAO/model/ISubDAO.sol";

interface IPollMaker is ISubDAO, IProposalChecker {

    event Poll(address indexed subject, address indexed creator, bytes32 indexed proposalId);

    function createPoll(address subject, string memory uri, bytes[] memory values, uint256 duration, address[] memory collectionAddresses, uint256[] memory collectionIds, uint256[] memory weights) external returns(bytes32[] memory proposalIds);

    function execute(bytes32 proposalId) external view returns(address subject, string memory uri, bytes[] memory values, bytes32[] memory proposalIds, uint256 ballotDuration);
}