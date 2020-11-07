// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../core/model/IOrganization.sol";
import "../../base/model/IStateManager.sol";
import "../../ext/subDAOsManager/model/ISubDAOsManager.sol";
import { Grimoire, State as EthereansState  } from "../lib/KnowledgeBase.sol";
import { Getters, State } from "../../base/lib/KnowledgeBase.sol";
import { Getters as ExtGetters } from "../../ext/lib/KnowledgeBase.sol";

contract DelegationsManagerAttachInsuranceRetriever {
    using Getters for IOrganization;
    using ExtGetters for IOrganization;
    using State for IStateManager;

    function get() external view returns(uint256) {
        IOrganization root = IOrganization(ILazyInitCapableElement(msg.sender).host());
        ISubDAOsManager subDAOsManager = root.subDAOsManager();
        if(address(subDAOsManager) == address(0)) {
            return 0;
        }
        IOrganization subDAO = IOrganization(subDAOsManager.get(Grimoire.SUBDAO_KEY_ETHEREANSOS_V1));
        if(address(subDAO) == address(0)) {
            return 0;
        }
        IStateManager stateManager = subDAO.stateManager();
        if(address(stateManager) == address(0)) {
            return 0;
        }
        return stateManager.getUint256(EthereansState.STATEMANAGER_ENTRY_NAME_DELEGATIONS_ATTACH_INSURANCE);
    }
}