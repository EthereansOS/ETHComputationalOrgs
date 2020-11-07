// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IFactoryOfFactories.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import { BehaviorUtilities, TransferUtilities, BytesUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "../../../core/model/IOrganization.sol";
import { Getters as ExternalGetters } from  "../../../ext/lib/KnowledgeBase.sol";
import { Getters, State } from  "../../../base/lib/KnowledgeBase.sol";
import { Grimoire as EthereansOSGrimoire, State as EthereansOSState } from  "../../lib/KnowledgeBase.sol";
import "../../../base/model/IStateManager.sol";
import "../../../ext/subDAOsManager/model/ISubDAOsManager.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

contract FactoryOfFactories is IFactoryOfFactories, LazyInitCapableElement {
    using TransferUtilities for address;
    using BytesUtilities for bytes;
    using Getters for IOrganization;
    using ExternalGetters for IOrganization;
    using State for IStateManager;

    uint256 private constant ONE_HUNDRED = 1e18;

    address private _tokenToBurnAddress;

    address[] private _hosts;
    address[][] private _factoryLists;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override returns (bytes memory lazyInitResponse) {
        (_tokenToBurnAddress, lazyInitResponse) = abi.decode(lazyInitData, (address, bytes));
        if(lazyInitResponse.length > 0) {
            (address[] memory hosts, bytes[][] memory factoryBytecodes) = abi.decode(lazyInitResponse, (address[], bytes[][]));
            _create(hosts, factoryBytecodes);
            lazyInitResponse = "";
        }
        return "";
    }

    function _supportsInterface(bytes4 interfaceId) internal pure override returns(bool) {
        return
            interfaceId == type(IFactoryOfFactories).interfaceId ||
            interfaceId == this.size.selector ||
            interfaceId == this.all.selector ||
            interfaceId == this.partialList.selector ||
            interfaceId == this.create.selector ||
            interfaceId == this.setFactoryListsMetadata.selector ||
            interfaceId == this.add.selector ||
            interfaceId == this.payFee.selector ||
            interfaceId == this.burnOrTransferTokenAmount.selector;
    }

    function size() external override view returns (uint256) {
        return _hosts.length;
    }

    function all() external override view returns (address[] memory, address[][] memory) {
        return (_hosts, _factoryLists);
    }

    function partialList(uint256 start, uint256 offset) external override view returns (address[] memory hosts, address[][] memory factoryLists) {
        (uint256 projectedArraySize, uint256 projectedArrayLoopUpperBound) = BehaviorUtilities.calculateProjectedArraySizeAndLoopUpperBound(_hosts.length, start, offset);
        if(projectedArraySize > 0) {
            hosts = new address[](projectedArraySize);
            factoryLists = new address[][](projectedArraySize);
            uint256 cursor = 0;
            for(uint256 i = start; i < projectedArrayLoopUpperBound; i++) {
                hosts[cursor] = _hosts[i];
                factoryLists[cursor++] = _factoryLists[i];
            }
        }
    }

    function get(uint256 index) external override view returns(address host, address[] memory factoryList) {
        if(index >= _hosts.length) {
            return (address(0), new address[](0));
        }
        return(_hosts[index], _factoryLists[index]);
    }

    function create(address[] calldata hosts, bytes[][] calldata factoryBytecodes) external override returns (address[][] memory factoryLists, uint256[] memory listPositions) {
        return _create(hosts, factoryBytecodes);
    }

    function setFactoryListsMetadata(uint256[] calldata listPositions, address[] calldata newHosts) external override returns (address[] memory replacedHosts) {
        replacedHosts = new address[](listPositions.length);
        for(uint256 i = 0; i < listPositions.length; i++) {
            uint256 listPosition = listPositions[i];
            require((replacedHosts[i] = _hosts[listPosition]) == msg.sender, "unauthorized");
            emit FactoryList(listPosition, replacedHosts[i], _hosts[listPosition] = newHosts[i]);
        }
    }

    function add(uint256[] calldata listPositions, bytes[][] calldata factoryBytecodes) external override returns(address[][] memory factoryLists, uint256[][] memory factoryPositions) {
        factoryPositions = new uint256[][](listPositions.length);
        factoryLists = new address[][](listPositions.length);
        for(uint256 i = 0; i < listPositions.length; i++) {
            require(_hosts[listPositions[i]] == msg.sender, "unauthorized");
            factoryPositions[i] = new uint256[](factoryBytecodes[i].length);
            factoryLists[i] = new address[](factoryBytecodes[i].length);
            address[] storage factoryListsStorage = _factoryLists[listPositions[i]];
            for(uint256 z = 0; z < factoryBytecodes[i].length; z++) {
                emit FactoryAdded(listPositions[i], msg.sender, factoryLists[i][z] = _create(factoryBytecodes[i][z]), factoryPositions[i][z] = factoryListsStorage.length);
                factoryListsStorage.push(factoryLists[i][z]);
            }
        }
    }

    function payFee(address sender, address tokenAddress, uint256 value, bytes calldata permitSignature, uint256 feePercentage, address feeReceiver) external payable override returns (uint256 feeSentOrBurnt, uint256 feePaid) {

        uint256 availableAmount = _calculatePercentage(value, feePercentage);
        require(availableAmount != 0, "value");

        (uint256 internalFeePercentage, address internalFeeReceiver,) = _feeInfo();

        _tryPerformPermit(tokenAddress, sender, availableAmount, permitSignature);

        if(internalFeePercentage > 0 && internalFeeReceiver != address(0)) {
            require((feeSentOrBurnt = _calculatePercentage(availableAmount, internalFeePercentage)) > 0, "zero");
            tokenAddress.safeTransferFrom(sender, tokenAddress == _tokenToBurnAddress ? address(this) : internalFeeReceiver, feeSentOrBurnt);
            if(tokenAddress == _tokenToBurnAddress) {
                ERC20Burnable(tokenAddress).burn(feeSentOrBurnt);
            }
            availableAmount -= feeSentOrBurnt;
        }

        feePaid = availableAmount;
        tokenAddress.safeTransferFrom(sender, feeReceiver, feePaid);

        if(tokenAddress == address(0)) {
            uint256 toGiveBack = msg.value - feeSentOrBurnt - feePaid;
            tokenAddress.safeTransfer(sender, toGiveBack);
        }
    }

    function _tryPerformPermit(address tokenAddress, address sender, uint256 availableAmount, bytes memory permitSignature) private {
        if(tokenAddress != address(0) && permitSignature.length > 0) {
            (uint8 v, bytes32 r, bytes32 s, uint256 deadline) = abi.decode(permitSignature, (uint8, bytes32, bytes32, uint256));
            IERC20Permit(tokenAddress).permit(sender, address(this), availableAmount, deadline, v, r, s);
        }
    }

    function burnOrTransferTokenAmount(address sender, address tokenAddress, uint256 value, bytes calldata permitSignature, address receiver) external payable override returns(uint256 feeSentOrBurnt, uint256 amountTransferedOrBurnt) {

        (,address feeReceiver, uint256 burnPercentage) = _feeInfo();

        require(tokenAddress != address(0), "No ETH");

        amountTransferedOrBurnt = value;
        require(amountTransferedOrBurnt != 0, "value");

        if(permitSignature.length > 0) {
            (uint8 v, bytes32 r, bytes32 s, uint256 deadline) = abi.decode(permitSignature, (uint8, bytes32, bytes32, uint256));
            IERC20Permit(tokenAddress).permit(sender, address(this), amountTransferedOrBurnt, deadline, v, r, s);
        }

        if(burnPercentage > 0 && feeReceiver != address(0)) {
            require((feeSentOrBurnt = _calculatePercentage(amountTransferedOrBurnt, burnPercentage)) > 0, "zero");
            tokenAddress.safeTransferFrom(sender, tokenAddress == _tokenToBurnAddress ? address(this) : feeReceiver, feeSentOrBurnt);
            if(tokenAddress == _tokenToBurnAddress) {
                ERC20Burnable(tokenAddress).burn(feeSentOrBurnt);
            }
            amountTransferedOrBurnt -= feeSentOrBurnt;
        }

        tokenAddress.safeTransferFrom(sender, receiver == address(0) ? address(this) : receiver, amountTransferedOrBurnt);
        if(receiver == address(0)) {
            try ERC20Burnable(tokenAddress).burn(amountTransferedOrBurnt) {
            } catch {
                tokenAddress.safeTransfer(0x000000000000000000000000000000000000dEaD, amountTransferedOrBurnt);
            }
        }
    }

    function _feeInfo() private view returns(uint256 feePercentage, address feeReceiver, uint256 burnPercentage) {
        if(host == address(0)) {
            return (feePercentage, feeReceiver, burnPercentage);
        }

        feeReceiver = address(IOrganization(host).treasurySplitterManager());
        feeReceiver = feeReceiver != address(0) ? feeReceiver : address(IOrganization(host).treasuryManager());

        IStateManager stateManager = IOrganization(host).stateManager();
        if(address(stateManager) == address(0)) {
            return (feePercentage, feeReceiver, burnPercentage);
        }

        string[] memory keys = new string[](2);
        keys[0] = EthereansOSState.STATEMANAGER_ENTRY_NAME_FACTORY_OF_FACTORIES_FEE_PERCENTAGE_FOR_TRANSACTED;
        keys[1] = EthereansOSState.STATEMANAGER_ENTRY_NAME_FACTORY_OF_FACTORIES_FEE_PERCENTAGE_FOR_BURN;
        IStateManager.StateEntry[] memory entries = stateManager.list(keys);

        feePercentage = entries[0].value.length > 0 ? entries[0].value.asUint256() : 0;
        burnPercentage = entries[1].value.length > 0 ? entries[1].value.asUint256() : 0;
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns(uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }

    function _create(address[] memory hosts, bytes[][] memory factoryBytecodes) private returns (address[][] memory factoryLists, uint256[] memory listPositions) {
        listPositions = new uint256[](hosts.length);
        factoryLists = new address[][](hosts.length);
        for(uint256 i = 0; i < hosts.length; i++) {
            listPositions[i] = _hosts.length;
            _hosts.push(hosts[i]);
            emit FactoryList(listPositions[i], address(0), hosts[i]);
            factoryLists[i] = new address[](factoryBytecodes[i].length);
            for(uint256 z = 0; z < factoryBytecodes[i].length; z++) {
                emit FactoryAdded(listPositions[i], hosts[i], factoryLists[i][z] = _create(factoryBytecodes[i][z]), z);
            }
            _factoryLists.push(factoryLists[i]);
        }
    }

    function _create(bytes memory factoryBytecode) private returns (address factoryAddress) {
        uint256 codeSize;
        assembly {
            factoryAddress := create(0, add(factoryBytecode, 0x20), mload(factoryBytecode))
            codeSize := extcodesize(factoryAddress)
        }
        require(codeSize > 0, "creation");
        require(ILazyInitCapableElement(factoryAddress).initializer() == address(this), "initializer");
    }
}