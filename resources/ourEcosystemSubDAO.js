var fs = require('fs');
var path = require('path');

module.exports = async function deploy(commonData) {

    var code = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./ethereans/osMinter/impl/OSMinter.sol";
import "./ethereans/osFixedInflationManager/impl/OSFixedInflationManager.sol";
import "./base/model/IProposalsManager.sol";
import {AddressUtilities, Uint256Utilities, BytesUtilities} from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "./core/model/IOrganization.sol";
import "@ethereansos/swissknife/contracts/factory/model/IFactory.sol";
import "./ethereans/factories/model/IOrganizationFactory.sol";
import "./ext/subDAOsManager/model/ISubDAOsManager.sol";
import "./ext/subDAO/model/ISubDAO.sol";
import "./ethereans/factories/model/ISubDAOFactory.sol";

contract DeploySubDAOContract {
    using AddressUtilities for address;
    using Uint256Utilities for uint256;
    using BytesUtilities for bytes;

    bytes private constant EMPTY = bytes("");

    address private sender = msg.sender;
    address public subDAO;

    function initialize(ISubDAO.SubDAOProposalModel[] memory proposalModels, bytes[] memory _specialComponents, bytes memory stateValues) external {
        require(sender == msg.sender);
        (subDAO,) = IFactory(${commonData.SUBDAO_FACTORY}).deploy(_subDAODeployData(proposalModels, _specialComponents, stateValues));//SubDAO Factory
    }

    function setInitialProposalModels(ISubDAO.SubDAOProposalModel[] memory proposalModels) external {
        require(sender == msg.sender);
        ISubDAOFactory(ILazyInitCapableElement(subDAO).initializer()).setInitialProposalModels(subDAO, proposalModels);
    }

    function _subDAODeployData(ISubDAO.SubDAOProposalModel[] memory proposalModels, bytes[] memory _specialComponents, bytes memory stateValues) private returns (bytes memory) {
        uint256[] memory ids = new uint256[](3);
        ids[0] = 2;//State Manager
        ids[1] = 3;//Treasury Splitter
        ids[2] = 6;//Investments Manager
        return abi.encode(IOrganizationFactory.OrganizationDeployData(
            "${commonData.ourSubDAOUri}",
            _subDAOProposalsManagerDeployData().asSingletonArray(),
            ids,
            _subDAOAdditionalComponents(stateValues),
            _specialComponents,
            abi.encode(true, address(0), proposalModels)
        ));
    }

    function _subDAOAdditionalComponents(bytes memory stateValues) private pure returns(bytes[] memory components) {
        components = new bytes[](3);
        components[0] = stateValues;
        components[1] = _treasurySplitterManager();
        components[2] = _investmentsManager();
    }

    function _treasurySplitterManager() private pure returns (bytes memory) {
        return abi.encode(
            ${commonData.treasurySplitterStartBlock || 0},
            ${commonData.TREASURY_SPLITTER_MANAGER.splitInterval},
            _treasurySplitterManagerKeys(),
            _treasurySplitterManagerPercentages(),
            ${commonData.TREASURY_SPLITTER_MANAGER.flushKey},
            ${commonData.executorRewardPercentage},
            ${commonData.executorRewardPercentage}
        );
    }

    function _investmentsManager() private pure returns (bytes memory) {
        return abi.encode(
            ${commonData.INVESTMENTS_MANAGER.componentManager},
            ${commonData.executorRewardPercentage},
            ${commonData.PRESTO_ADDRESS},
            abi.encode(
                ${commonData.OS_ADDRESS},
                _investmentsManagerTokensFromETH()
            ),
            abi.encode(
                ${commonData.swapToETHStartBlock || '0'},
                ${commonData.INVESTMENTS_MANAGER.swapToETHInterval},
                _investmentsManagerTokensToETH(),
                _investmentsManagerTokensToETHPercentages()
            )
        );
    }

    function _treasurySplitterManagerKeys() private pure returns (bytes32[] memory keys) {
        keys = new bytes32[](${commonData.TREASURY_SPLITTER_MANAGER.keys.length});
${commonData.TREASURY_SPLITTER_MANAGER.keys.map((it, i) => `        keys[${i}] = ${it};`).join('\n')}
    }

    function _treasurySplitterManagerPercentages() private pure returns (uint256[] memory percentages) {
        percentages = new uint256[](${commonData.TREASURY_SPLITTER_MANAGER.percentages.length});
${commonData.TREASURY_SPLITTER_MANAGER.percentages.map((it, i) => `        percentages[${i}] = ${it};`).join('\n')}
    }

    function _investmentsManagerTokensFromETH() private pure returns (address[] memory array) {
        array = new address[](${commonData.INVESTMENTS_MANAGER.tokensFromETH.length});
${commonData.INVESTMENTS_MANAGER.tokensFromETH.map((it, i) => `        array[${i}] = ${it};`).join('\n')}
    }

    function _investmentsManagerTokensToETH() private pure returns (address[] memory array) {
        array = new address[](${commonData.INVESTMENTS_MANAGER.tokensToETH.length});
${commonData.INVESTMENTS_MANAGER.tokensToETH.map((it, i) => `        array[${i}] = ${it};`).join('\n')}
    }

    function _investmentsManagerTokensToETHPercentages() private pure returns (uint256[] memory array) {
        array = new uint256[](${commonData.INVESTMENTS_MANAGER.tokensToETHPercentages.length});
${commonData.INVESTMENTS_MANAGER.tokensToETHPercentages.map((it, i) => `        array[${i}] = ${it};`).join('\n')}
    }

    function _subDAOProposalsManagerDeployData() private pure returns (bytes memory) {
        address collection = ${commonData.ITEM_MAININTERFACE};
        uint256 OS_ID = ${commonData.OS_ID};
        uint256 weight = 1;
        address[] memory empty = new address[](0);
        return abi.encode(IProposalsManager.ProposalConfiguration(
            collection.asSingletonArray(),
            OS_ID.asSingletonArray(),
            weight.asSingletonArray(),
            address(0),
            address(0),
            empty,
            empty
        ));
    }
}`;

    var location = path.resolve(__dirname, '../contracts/DeploySubDAOContract.sol');

    try {
        fs.unlinkSync(location);
    } catch(e) {
    }

    fs.writeFileSync(location, code);

    return "DeploySubDAOContract";
}