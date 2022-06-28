// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../delegation/model/IDelegationTokensManager.sol";
import "../../delegationsManager/model/IDelegationsManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "../../../base/model/IProposalsManager.sol";
import "../../../core/model/IOrganization.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import "@ethereansos/items-core/contracts/projection/IItemProjection.sol";
import "@ethereansos/items-core/contracts/projection/factory/model/IItemProjectionFactory.sol";
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

    function wrap(address sourceDelegationsManagerAddress, bytes memory permitSignature, uint256 amount, address receiver) payable external override returns(uint256 wrappedObjectId) {
        require(sourceDelegationsManagerAddress != address(0), "Delegations Manager");
        (address supportedCollection, uint256 supportedObjectId) = IDelegationsManager(sourceDelegationsManagerAddress).supportedToken();
        require(supportedCollection == address(0), "Use safeTransferFrom");
        address tokenAddress = address(uint160(supportedObjectId));
        require(tokenAddress != address(0) ? msg.value == 0 : msg.value == amount, "ETH");
        if(tokenAddress != address(0) && permitSignature.length > 0) {
            (uint8 v, bytes32 r, bytes32 s, uint256 deadline) = abi.decode(permitSignature, (uint8, bytes32, bytes32, uint256));
            IERC20Permit(tokenAddress).permit(msg.sender, address(this), amount, deadline, v, r, s);
        }
        _wrap(address(0), uint160(tokenAddress), _safeTransferFrom(tokenAddress, amount), sourceDelegationsManagerAddress, receiver != address(0) ? receiver : msg.sender);
        (, wrappedObjectId) = wrapped(address(0), uint160(tokenAddress), sourceDelegationsManagerAddress);
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
        require(delegationsManagerAddress != address(0), "Delegations Manager");
        (bool attached,,) = IDelegationsManager(delegationsManagerAddress).exists(host);
        require(attached, "attach");
        (address supportedCollection, uint256 supportedObjectId) = IDelegationsManager(delegationsManagerAddress).supportedToken();
        require(collectionAddress == supportedCollection && id == supportedObjectId, "unsupported");
        _swap(collectionAddress, id, delegationsManagerAddress, value, receiver);
    }

    function _unwrap(address wrappedCollectionAddress, uint256 wrappedObjectId, uint256 value, address receiver, bytes memory response) private {
        require(wrappedCollectionAddress == itemMainInterfaceAddress, "No Item");
        require(_sourceDelegationsManagerAddress[wrappedObjectId] != address(0), "Unknown");
        address sourceCollectionAddress = _sourceCollectionAddress[wrappedObjectId];
        uint256 sourceObjectId = _sourceObjectId[wrappedObjectId];
        uint256 sourceUnity = (10**(18 - _sourceDecimals[wrappedObjectId]));
        uint256 sourceValue = value / sourceUnity;
        require(value == (sourceValue * sourceUnity), "non-consistent value");
        IOrganization(host).treasuryManager().transfer(sourceCollectionAddress == address(0) ? address(uint160(sourceObjectId)) : sourceCollectionAddress, sourceValue, receiver, sourceCollectionAddress == address(0) ? 0 : 2, sourceObjectId, true, true, response);
        Item(itemMainInterfaceAddress).burn(address(this), wrappedObjectId, value);
    }

    function _swap(address sourceCollectionAddress, uint256 sourceObjectId, address sourceDelegationsManagerAddress, uint256 value, address receiver) private {
        if(sourceCollectionAddress != address(0)) {
            IERC1155(sourceCollectionAddress).safeTransferFrom(address(this), address(IOrganization(host).treasuryManager()), sourceObjectId, value, "");
        }
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
    }

    function _newWrap(address sourceCollectionAddress, uint256 sourceObjectId, address sourceDelegationsManagerAddress, uint256 sourceDecimals, uint256 createdItemId) private returns (uint256 wrappedObjectId) {
        _sourceCollectionAddress[_wrappedObjectId[keccak256(abi.encodePacked(sourceCollectionAddress, sourceObjectId, sourceDelegationsManagerAddress))] = wrappedObjectId = createdItemId] = sourceCollectionAddress;
        _sourceObjectId[wrappedObjectId] = sourceObjectId;
        _sourceDelegationsManagerAddress[wrappedObjectId] = sourceDelegationsManagerAddress;
        _sourceDecimals[wrappedObjectId] = sourceDecimals;
        emit Wrapped(sourceCollectionAddress, sourceObjectId, sourceDelegationsManagerAddress, wrappedObjectId);
    }

    function _sourceHeaderAndDecimals(uint256 wrappedObjectId, address sourceCollectionAddress, uint256 sourceObjectId) private view returns (Header memory sourceHeader, uint256 sourceDecimals) {
        if(wrappedObjectId != 0) {
            return (sourceHeader, sourceDecimals = _sourceDecimals[wrappedObjectId]);
        }
        string memory symbol = "";
        if(sourceCollectionAddress != address(0)) {
            (, symbol, sourceDecimals) = _tryRecoveryMetadata(sourceCollectionAddress, sourceObjectId);
        } else {
            (, symbol, sourceDecimals) = _tryRecoveryMetadata(address(uint160(sourceObjectId)));
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
            try Item(tokenAddress).decimals() returns(uint256 dec) {
                decimals = dec;
            } catch {
            }
        }
        require(decimals == 0 || decimals == 18, "Decimals");
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
        address treasuryManagerAddress = address(IOrganization(host).treasuryManager());
        if(erc20TokenAddress == address(0)) {
            erc20TokenAddress.safeTransfer(treasuryManagerAddress, value);
            return value;
        }
        uint256 previousBalance = erc20TokenAddress.balanceOf(treasuryManagerAddress);
        erc20TokenAddress.safeTransferFrom(msg.sender, treasuryManagerAddress, value);
        uint256 actualBalance = erc20TokenAddress.balanceOf(treasuryManagerAddress);
        require(actualBalance > previousBalance);
        return actualBalance - previousBalance;
    }
}