
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

contract GetItemProposalWeightFunctionality {

    // Mapping that given an address return its weight in the DFO proposals
    mapping(address => uint256) private _itemWeights;

    constructor(address[] items, uint256[] weights) public {
        for(uint256 i = 0; i < items.length; i++) {
          if(items[i] != address(0)) {
              _itemWeights[items[i]] = weights[i];
          }
      }
    }

    function onStart(address newSurvey, address oldSurvey) public {
    }

    function onStop(address newSurvey) public {
    }

    /** @dev Returns the weight of the item in a proposal.
      * @param itemAddress item for proposal.
      * @return item weight.
      */
    function getItemProposalWeight(address itemAddress) public view returns(uint256) {
        return _itemWeights[itemAddress];
    }
}