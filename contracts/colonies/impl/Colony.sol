// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "./AbstractColony.sol";
import "../../core/model/IOrganization.sol";
import "../../ext/treasurySplitterManager/model/ITreasurySplitterManager.sol";
import "../../ext/subDAOsManager/model/ISubDAOsManager.sol";
import { Grimoire } from "../../ethereans/lib/KnowledgeBase.sol";
import { Getters } from "../../base/lib/KnowledgeBase.sol";
import { Getters as ExternalGetters } from "../../ext/lib/KnowledgeBase.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Colony is AbstractColony {
    using Getters for IOrganization;
    using ExternalGetters for IOrganization;
    using TransferUtilities for address;

    address public tokenToBurnAddress;

    constructor(bytes memory data) AbstractColony(data) {
    }

    function resolveReceiver() public override view returns(address receiver) {
        IOrganization rootOrganization = IOrganization(receiverResolver);
        ISubDAOsManager subDAOsManager = rootOrganization.subDAOsManager();
        IOrganization subDAO = IOrganization(subDAOsManager.get(Grimoire.SUBDAO_KEY_ETHEREANSOS_V1));
        IOrganization host = address(subDAO) != address(0) ? subDAO : rootOrganization;
        receiver = address(host.treasurySplitterManager());
        receiver = receiver != address(0) ? receiver : address(host.treasuryManager());
    }

    function _send(address token, address to, uint256 amount, uint256 executorReward, address rewardReceiver, uint32, bytes memory) internal override {
        token.safeTransfer(rewardReceiver, executorReward);
        if(token == tokenToBurnAddress) {
            if(amount > 0) {
                ERC20Burnable(tokenToBurnAddress).burn(amount);
            }
        } else {
            token.safeTransfer(to, amount);
        }
    }

    function _colonyLazyInit(bytes memory data) internal override returns(bytes memory) {
        tokenToBurnAddress = abi.decode(data, (address));
        return "";
    }
}