// SPDX-License-Identifier: BSD-2
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

contract GetItemProposalWeightFunctionality {

    // Mapping that given an object id return its weight in the DFO proposals
    mapping(uint256 => uint256) private _itemWeights;
    // Array that contains all the items
    uint256[] public votingItems;

    constructor(uint256[] memory items, uint256[] memory weights) public {
        votingItems = items;
        for(uint256 i = 0; i < items.length; i++) {
            _itemWeights[items[i]] = weights[i];
        }
    }

    /**
     * @dev Each Microservice needs to implement its own logic for handling what happens when it's added or removed from a a DFO
     * onStart is one of this mandatory functions.
     * onStart is triggered when a microservice is added.
     * The method body can be left blank (i.e. you don't need any special startup/teardown logic)
     * The only strict requirement is for the method to be there.
     */
    function onStart(address, address) public {}

    /**
     * @dev Each Microservice needs to implement its own logic for handling what happens when it's added or removed from a a DFO
     * onStop is one of this mandatory functions.
     * onStop is triggered when a microservice is removed.
     * The method body can be left blank (i.e. you don't need any special startup/teardown logic)
     * The only strict requirement is for the method to be there.
     */
    function onStop(address) public {}

    /** @dev Returns the weight of the item in a proposal.
      * @param itemAddress item for proposal.
      * @return item weight.
      */
    function getItemProposalWeight(uint256 itemAddress) public view returns(uint256) {
        return _itemWeights[itemAddress];
    }
}