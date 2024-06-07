// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "./HardCabledInfo.sol";
import "@ethereansos/swissknife/contracts/factory/model/IFactory.sol";
import "../../base/model/IProposalsManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@ethereansos/items-core/contracts/model/Item.sol";

contract CanBeTerminatedAfter is HardCabledInfo, IProposalChecker {

    constructor(bytes32[] memory strings) HardCabledInfo(strings) {}

    function validateInput(bytes calldata checkerData) external override pure {
        uint256 value = abi.decode(checkerData, (uint256));
        require(value > 0);
    }

    function check(address, bytes calldata checkerData, bytes32, bytes calldata proposalData, address, address) external override view returns(bool) {
        uint256 value = abi.decode(checkerData, (uint256));
        return block.timestamp >= (value + abi.decode(proposalData, (IProposalsManager.Proposal)).creationTime);
    }
}

contract CanBeTerminatedWhenHardCapReached is HardCabledInfo, IProposalChecker {

    uint256 public constant ONE_HUNDRED = 1e18;

    constructor(bytes32[] memory strings) HardCabledInfo(strings) {}

    function validateInput(bytes calldata checkerData) external override pure {
        (uint256 value,) = abi.decode(checkerData, (uint256, bool));
        require(value > 0);
    }

    function check(address, bytes calldata checkerData, bytes32, bytes calldata proposalData, address, address) external override view returns(bool) {
        (uint256 value, bool discriminant) = abi.decode(checkerData, (uint256, bool));
        IProposalsManager.Proposal memory proposal = abi.decode(proposalData, (IProposalsManager.Proposal));
        uint256 hardCap = discriminant ? _calculatePercentage(_calculateHardCap(proposal), value) : value;
        return proposal.accept >= hardCap;
    }

    function _calculateHardCap(IProposalsManager.Proposal memory proposal) private view returns (uint256 hardCap) {
        (address[] memory collectionAddresses, uint256[] memory objectIds, uint256[] memory weights) = abi.decode(proposal.votingTokens, (address[], uint256[], uint256[]));
        for(uint256 i = 0; i < collectionAddresses.length; i++) {
            hardCap += (_calculateTotalSupply(collectionAddresses[i], objectIds[i]) * weights[i]);
        }
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns (uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }

    function _calculateTotalSupply(address collectionAddress, uint256 collectionId) private view returns(uint256) {
        if(collectionAddress == address(0)) {
            return IERC20(address(uint160(collectionId))).totalSupply();
        }
        return Item(collectionAddress).totalSupply(collectionId);
    }
}