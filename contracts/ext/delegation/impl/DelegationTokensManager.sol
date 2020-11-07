// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../delegation/model/IDelegationTokensManager.sol";
import "../../delegationsManager/model/IDelegationsManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "../../../base/model/IProposalsManager.sol";
import "../../../core/model/IOrganization.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import "@ethereansos/items-v2/contracts/projection/IItemProjection.sol";
import "@ethereansos/items-v2/contracts/projection/factory/model/IItemProjectionFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import { AddressUtilities, TransferUtilities, Uint256Utilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

contract DelegationTokensManager is IDelegationTokensManager, LazyInitCapableElement {
    using ReflectionUtilities for address;
    using AddressUtilities for address;
    using Getters for IOrganization;
    using TransferUtilities for address;
    using Uint256Utilities for uint256;

    mapping(bytes32 => uint256) private _wrappedObjectId;
    mapping(uint256 => address) private _sourceCollectionAddress;
    mapping(uint256 => uint256) private _sourceObjectId;
    mapping(uint256 => address) private _sourceDelegationsManagerAddress;
    mapping(uint256 => uint256) private _sourceDecimals;

    address public override itemMainInterfaceAddress;
    address public override projectionAddress;
    bytes32 public override collectionId;
    string public override ticker;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override returns (bytes memory) {
        ticker = abi.decode(lazyInitData, (string));
        itemMainInterfaceAddress = IItemProjectionFactory(projectionAddress = initializer).mainInterface();
        collectionId = IItemProjection(projectionAddress).collectionId();
        return "";
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == this.onERC1155Received.selector ||
            interfaceId == this.onERC1155BatchReceived.selector ||
            interfaceId == type(IDelegationTokensManager).interfaceId ||
            interfaceId == this.itemMainInterfaceAddress.selector ||
            interfaceId == this.projectionAddress.selector ||
            interfaceId == this.collectionId.selector ||
            interfaceId == this.wrap.selector ||
            interfaceId == this.wrapped.selector ||
            interfaceId == this.source.selector;
    }

    function wrapped(address sourceCollection, uint256 sourceObjectId, address sourceDelegationsAddress) public override view returns(address wrappedCollection, uint256 wrappedObjectId) {
        return (itemMainInterfaceAddress, _wrappedObjectId[keccak256(abi.encodePacked(sourceCollection, sourceObjectId, sourceDelegationsAddress))]);
    }

    function source(uint256 wrappedObjectId) public override view returns(address sourceCollectionAddress, uint256 sourceObjectId, address sourceDelegationsManagerAddress) {
        sourceCollectionAddress = _sourceCollectionAddress[wrappedObjectId];
        sourceObjectId = _sourceObjectId[wrappedObjectId];
        sourceDelegationsManagerAddress = _sourceDelegationsManagerAddress[wrappedObjectId];
    }

    function wrap(address[] calldata tokenAddresses, uint256[][] calldata amounts, address[][] calldata receivers, address[] calldata delegationManagersAddress) override payable external returns(uint256[] memory itemIds) {
        revert("For next versions");
        /*require(tokenAddresses.length == amounts.length && amounts.length == receivers.length, "length");
        uint256[] memory loadedItemIds = new uint256[](tokenAddresses.length);
        uint256[] memory sourceDecimals = new uint256[](tokenAddresses.length);
        uint256 ethAmount = 0;
        CreateItem[] memory createItems = new CreateItem[](tokenAddresses.length);
        address treasuryManager = address(IOrganization(host).treasuryManager());
        for(uint256 i = 0; i < tokenAddresses.length; i++) {
            address tokenAddress = tokenAddresses[i];
            uint256 sourceId = uint160(tokenAddress);
            uint256[] memory tokenAmounts = amounts[i];
            address[] memory tokenReceivers = receivers[i];
            address sourceDelegationsManagerAddress =  delegationManagersAddress[i < delegationManagersAddress.length ? i : 0];
            uint256 wrappedObjectId = loadedItemIds[i] = _wrappedObjectId[keccak256(abi.encodePacked(address(0), sourceId, sourceDelegationsManagerAddress))];
            uint256 partialEthAmount = 0;
            (createItems[i], partialEthAmount, sourceDecimals[i]) = _buildCreateItem(tokenAddress, wrappedObjectId, tokenAmounts, tokenReceivers, treasuryManager);
            ethAmount += partialEthAmount;
        }
        require(msg.value >= ethAmount, "Invalid ETH Value");
        if(msg.value > ethAmount) {
            address(0).safeTransfer(msg.sender, msg.value - ethAmount);
        }
        itemIds = IItemProjection(projectionAddress).mintItems(createItems);
        for(uint256 i = 0; i < loadedItemIds.length; i++) {
            uint256 sourceObjectId = uint160(tokenAddresses[i]);
            address sourceDelegationsManagerAddress = delegationManagersAddress[i < delegationManagersAddress.length ? i : 0];
            uint256 itemId = itemIds[i];
            if(loadedItemIds[i] == 0) {
                uint256 srcd = _sourceDecimals[loadedItemIds[i] = itemIds[i]] = sourceDecimals[i];
                _newWrap(address(0), sourceObjectId, sourceDelegationsManagerAddress, srcd, itemId);
            }
        }*/
    }

    function onERC1155Received(address, address from, uint256 id, uint256 value, bytes calldata data) external override returns(bytes4) {
        _onReceived(from, msg.sender, id, value, data);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external override returns(bytes4) {
        bytes[] memory datas = abi.decode(data, (bytes[]));
        for(uint256 i = 0; i < ids.length; i++) {
            _onReceived(from, msg.sender, ids[i], values[i], datas[i]);
        }
        return this.onERC1155BatchReceived.selector;
    }

    function _onReceived(address from, address collectionAddress, uint256 objectId, uint256 value, bytes memory data) private {
        (address delegationsManagerAddress, address receiver, bytes memory response) = abi.decode(data, (address, address, bytes));
        _wrapOrUnrwap(from, collectionAddress, objectId, value, delegationsManagerAddress, receiver, response);
    }

    function _wrapOrUnrwap(address from, address collectionAddress, uint256 objectId, uint256 value, address delegationsManagerAddress, address receiver, bytes memory response) private {
        receiver = receiver != address(0) ? receiver : from;
        return delegationsManagerAddress != address(0) ? _wrap(collectionAddress, objectId, value, delegationsManagerAddress, receiver) : _unwrap(collectionAddress, objectId, value, receiver, response);
    }

    function _wrap(address collectionAddress, uint256 id, uint256 value, address delegationsManagerAddress, address receiver) private {
        (bool attached,,) = IDelegationsManager(delegationsManagerAddress).exists(host);
        require(attached, "attach");
        (address supportedCollection, uint256 supportedObjectId) = IDelegationsManager(delegationsManagerAddress).supportedToken();
        require(collectionAddress == supportedCollection && id == supportedObjectId, "unsupported");
        _swap(collectionAddress, id, delegationsManagerAddress, value, receiver);
    }

    function _unwrap(address wrappedCollectionAddress, uint256 wrappedObjectId, uint256 value, address receiver, bytes memory response) private {
        require(wrappedCollectionAddress == itemMainInterfaceAddress, "No Item");
        address sourceCollectionAddress = _sourceCollectionAddress[wrappedObjectId];
        uint256 sourceObjectId = _sourceObjectId[wrappedObjectId];
        uint256 sourceUnity = (10**(18 - _sourceDecimals[wrappedObjectId]));
        uint256 sourceValue = value / sourceUnity;
        require(value == (sourceValue * sourceUnity), "non-consistent value");
        IOrganization(host).treasuryManager().transfer(sourceCollectionAddress == address(0) ? address(uint160(sourceObjectId)) : sourceCollectionAddress, sourceValue, receiver, sourceCollectionAddress == address(0) ? 0 : 2, sourceObjectId, true, true, response);
        Item(itemMainInterfaceAddress).burn(address(this), wrappedObjectId, value);
    }

    function _swap(address sourceCollectionAddress, uint256 sourceObjectId, address sourceDelegationsManagerAddress, uint256 value, address receiver) private {
        (, uint256 wrappedObjectId) = wrapped(sourceCollectionAddress, sourceObjectId, sourceDelegationsManagerAddress);
        (Header memory sourceHeader, uint256 sourceDecimals) = _sourceHeaderAndDecimals(wrappedObjectId, sourceCollectionAddress, sourceObjectId);
        CreateItem[] memory createItems = new CreateItem[](1);
        createItems[0] = CreateItem(sourceHeader, collectionId, wrappedObjectId, new address[](1), new uint256[](1));
        createItems[0].accounts[0] = receiver;
        createItems[0].amounts[0] = value * (10**(18 - sourceDecimals));
        uint256[] memory createdItemIds = IItemProjection(projectionAddress).mintItems(createItems);
        if(wrappedObjectId == 0) {
            wrappedObjectId = _newWrap(sourceCollectionAddress, sourceObjectId, sourceDelegationsManagerAddress, sourceDecimals, createdItemIds[0]);
        }
        IERC1155(sourceCollectionAddress).safeTransferFrom(address(this), address(IOrganization(host).treasuryManager()), sourceObjectId, value, "");
    }

    function _newWrap(address sourceCollectionAddress, uint256 sourceObjectId, address sourceDelegationsManagerAddress, uint256 sourceDecimals, uint256 createdItemId) private returns (uint256 wrappedObjectId) {
        _sourceCollectionAddress[_wrappedObjectId[keccak256(abi.encodePacked(sourceCollectionAddress, sourceObjectId, sourceDelegationsManagerAddress))] = wrappedObjectId = createdItemId] = sourceCollectionAddress;
        _sourceObjectId[wrappedObjectId] = sourceObjectId;
        _sourceDelegationsManagerAddress[wrappedObjectId] = sourceDelegationsManagerAddress;
        _sourceDecimals[wrappedObjectId] = sourceDecimals;
        emit Wrapped(sourceCollectionAddress, sourceObjectId, sourceDelegationsManagerAddress, wrappedObjectId);
    }

    function _buildCreateItem(address tokenAddress, uint256 wrappedObjectId, uint256[] memory amounts, address[] memory receivers, address treasuryManagerAddres) private returns(CreateItem memory createItem, uint256 partialEthAmount, uint256 sourceDecimals) {
        uint256 totalAmount = 0;
        address[] memory realReceivers = new address[](amounts.length);
        for(uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
            if(tokenAddress == address(0)) {
                partialEthAmount += amounts[i];
            }
            realReceivers[i] = (realReceivers[i] = i < receivers.length ? receivers[i] : msg.sender);
            realReceivers[i] = realReceivers[i] != address(0) ? realReceivers[i] : msg.sender;
        }
        if(tokenAddress != address(0)) {
            uint256 previousBalance = IERC20(tokenAddress).balanceOf(treasuryManagerAddres);
            tokenAddress.safeTransferFrom(msg.sender, treasuryManagerAddres, totalAmount);
            uint256 realAmount = IERC20(tokenAddress).balanceOf(treasuryManagerAddres) - previousBalance;
            if(realAmount != totalAmount) {
                require(amounts.length == 1, "Only single transfers allowed for this kind of token");
                amounts[0] = realAmount;
            }
        }
        (createItem, sourceDecimals) = _buildCreateItem(address(0), uint160(tokenAddress), wrappedObjectId, amounts, receivers);
    }

    function _buildCreateItem(address sourceCollectionAddress, uint256 sourceObjectId, uint256 wrappedObjectId, uint256[] memory amounts, address[] memory receivers) private view returns (CreateItem memory createItem, uint256 sourceDecimals) {
        Header memory sourceHeader;
        (sourceHeader, sourceDecimals) = _sourceHeaderAndDecimals(wrappedObjectId, sourceCollectionAddress, sourceObjectId);
        for(uint256 i = 0; i < amounts.length; i++) {
            amounts[i] = (amounts[i] * (10**(18 - sourceDecimals)));
        }
        createItem = CreateItem(sourceHeader, collectionId, wrappedObjectId, receivers, amounts);
    }

    function _sourceHeaderAndDecimals(uint256 wrappedObjectId, address sourceCollectionAddress, uint256 sourceObjectId) private view returns (Header memory sourceHeader, uint256 sourceDecimals) {
        if(wrappedObjectId != 0) {
            return (sourceHeader, sourceDecimals = _sourceDecimals[wrappedObjectId]);
        }
        string memory name = "";
        string memory symbol = "";
        if(sourceCollectionAddress != address(0)) {
            (name, symbol, sourceDecimals) = _tryRecoveryMetadata(sourceCollectionAddress, sourceObjectId);
        } else {
            (name, symbol, sourceDecimals) = _tryRecoveryMetadata(address(uint160(sourceObjectId)));
        }
        sourceHeader = Header(address(0), ticker, string(abi.encodePacked("D", symbol)), "");
    }

    function _tryRecoveryMetadata(address tokenAddress, uint256 tokenId) private view returns(string memory name, string memory symbol, uint256 decimals) {
        IItemProjection nft = IItemProjection(tokenAddress);
        try nft.name(tokenId) returns(string memory n) {
            name = n;
        } catch {
        }
        try nft.symbol(tokenId) returns(string memory s) {
            symbol = s;
        } catch {
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            try nft.name() returns(string memory n) {
                name = n;
            } catch {
            }
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            try nft.symbol() returns(string memory s) {
                symbol = s;
            } catch {
            }
        }
        if(keccak256(bytes(name)) == keccak256("")) {
            name = tokenAddress.toString();
        }
        if(keccak256(bytes(symbol)) == keccak256("")) {
            symbol = tokenAddress.toString();
        }
        try Item(tokenAddress).decimals(tokenId) returns(uint256 dec) {
            decimals = dec;
        } catch {
        }
    }

    function _tryRecoveryMetadata(address tokenAddress) private view returns(string memory name, string memory symbol, uint256 decimals) {
        name = tokenAddress == address(0) ? "Ethereum" : _stringValue(tokenAddress, "name()", "NAME()");
        symbol = tokenAddress == address(0) ? "ETH" : _stringValue(tokenAddress, "symbol()", "SYMBOL()");
        decimals = tokenAddress == address(0) ? 18 : IERC20Metadata(tokenAddress).decimals();
    }

    function _stringValue(address erc20TokenAddress, string memory firstTry, string memory secondTry) private view returns(string memory) {
        (bool success, bytes memory data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(firstTry));
        if (!success) {
            (success, data) = erc20TokenAddress.staticcall{ gas: 20000 }(abi.encodeWithSignature(secondTry));
        }

        if (success && data.length >= 96) {
            (uint256 offset, uint256 len) = abi.decode(data, (uint256, uint256));
            if (offset == 0x20 && len > 0 && len <= 256) {
                return string(abi.decode(data, (bytes)));
            }
        }

        if (success && data.length == 32) {
            uint len = 0;
            while (len < data.length && data[len] >= 0x20 && data[len] <= 0x7E) {
                len++;
            }

            if (len > 0) {
                bytes memory result = new bytes(len);
                for (uint i = 0; i < len; i++) {
                    result[i] = data[i];
                }
                return string(result);
            }
        }

        return erc20TokenAddress.toString();
    }

    function _safeTransferFrom(address erc20TokenAddress, uint256 value) private returns(uint256) {
        if(erc20TokenAddress == address(0)) {
            return value;
        }
        uint256 previousBalance = IERC20(erc20TokenAddress).balanceOf(address(this));
        _safeTransferOrTransferFrom(erc20TokenAddress, msg.sender, address(this), value);
        uint256 actualBalance = IERC20(erc20TokenAddress).balanceOf(address(this));
        require(actualBalance > previousBalance);
        return actualBalance - previousBalance;
    }

    function _safeTransferOrTransferFrom(address erc20TokenAddress, address from, address to, uint256 value) private {
        if(value == 0) {
            return;
        }
        if(erc20TokenAddress == address(0)) {
            if(from != address(0)) {
                return;
            }
            to.submit(value, "");
            return;
        }
        bytes memory returnData = erc20TokenAddress.submit(0, from == address(0) ? abi.encodeWithSelector(IERC20(address(0)).transfer.selector, to, value) : abi.encodeWithSelector(IERC20(address(0)).transferFrom.selector, from, to, value));
        require(returnData.length == 0 || abi.decode(returnData, (bool)));
    }
}