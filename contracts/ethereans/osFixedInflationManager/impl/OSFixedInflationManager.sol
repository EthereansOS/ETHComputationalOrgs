// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IOSFixedInflationManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import { ReflectionUtilities, TransferUtilities, Uint256Utilities, AddressUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import { Getters as ExtGetters } from "../../../ext/lib/KnowledgeBase.sol";
import { ComponentsGrimoire } from "../../lib/KnowledgeBase.sol";
import "../../../core/model/IOrganization.sol";
import "../../../base/model/ITreasuryManager.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../../osMinter/model/IOSMinter.sol";

contract OSFixedInflationManager is IOSFixedInflationManager, LazyInitCapableElement {
    using Uint256Utilities for uint256;
    using AddressUtilities for address;
    using Getters for IOrganization;
    using ExtGetters for IOrganization;
    using TransferUtilities for address;

    uint256 public constant override ONE_HUNDRED = 1e18;

    uint256 public ONE_YEAR/* = 2336000*/;
    uint256 public DAYS_IN_YEAR/* = 365*/;

    uint256 public override lastTokenTotalSupply;
    uint256 public override lastTokenTotalSupplyUpdate;

    uint256 public override lastTokenPercentage;
    uint256 public override lastInflationPerDay;

    address private _tokenToMintAddress;

    uint256 public override executorRewardPercentage;

    address public override prestoAddress;

    uint256 public override lastSwapToETHEvent;
    uint256 public override swapToETHInterval;

    uint256 public override tokenReceiverPercentage;

    address private _destinationWalletOwner;
    address private _destinationWalletAddress;
    uint256 private _destinationWalletPercentage;

    address private _ammPlugin;
    address[] private _liquidityPoolAddresses;
    address[] private _swapPath;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override virtual returns (bytes memory lazyInitResponse) {
        uint256 firstSwapToETHEvent;
        uint256 _swapToETHInterval;
        bytes memory destinationWalletData;
        (destinationWalletData, lazyInitData, lazyInitResponse) = abi.decode(lazyInitData, (bytes, bytes, bytes));
        (tokenReceiverPercentage, _destinationWalletOwner, _destinationWalletAddress, _destinationWalletPercentage) = abi.decode(destinationWalletData, (uint256, address, address, uint256));
        (lastTokenPercentage, ONE_YEAR, DAYS_IN_YEAR, _tokenToMintAddress) = abi.decode(lazyInitData, (uint256, uint256, uint256, address));
        (executorRewardPercentage, prestoAddress, firstSwapToETHEvent, _swapToETHInterval, lazyInitResponse) = abi.decode(lazyInitResponse, (uint256, address, uint256, uint256, bytes));
        swapToETHInterval = _swapToETHInterval;
        if(firstSwapToETHEvent != 0 && _swapToETHInterval < firstSwapToETHEvent) {
            lastSwapToETHEvent = firstSwapToETHEvent - _swapToETHInterval;
        }
        _finalize(lazyInitResponse);
        lazyInitResponse = "";
    }

    function _finalize(bytes memory lazyInitResponse) private {
        (_ammPlugin, _liquidityPoolAddresses, _swapPath, lastTokenTotalSupply, lastTokenTotalSupplyUpdate, lastInflationPerDay) = abi.decode(lazyInitResponse, (address, address[], address[], uint256, uint256, uint256));
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IOSFixedInflationManager).interfaceId ||
            interfaceId == this.ONE_HUNDRED.selector ||
            interfaceId == this.executorRewardPercentage.selector ||
            interfaceId == this.prestoAddress.selector;
    }

    bool private _receiving;
    receive() external payable {
        require(_receiving);
    }

    function swapData() external override view returns(address ammPlugin, address[] memory liquidityPoolAddresses, address[] memory swapPath) {
        return (_ammPlugin, _liquidityPoolAddresses, _swapPath);
    }

    function tokenInfo() public override view returns(address tokenToMintAddress, address tokenMinterAddress) {
        tokenToMintAddress = _tokenToMintAddress;
        tokenMinterAddress = IOrganization(host).get(ComponentsGrimoire.COMPONENT_KEY_TOKEN_MINTER);
    }

    function updateTokenPercentage(uint256 newValue) external override authorizedOnly returns(uint256 oldValue) {
        oldValue = lastTokenPercentage;
        updateInflationData();
        if(newValue != lastTokenPercentage) {
            //let's change percentage
            lastTokenPercentage = newValue;
            lastInflationPerDay = _calculatePercentage(lastTokenTotalSupply, lastTokenPercentage) / DAYS_IN_YEAR;
        }
    }

    function updateInflationData() public override {
        //If first time or almost one year passed since last totalSupply update
        if(lastTokenTotalSupply == 0 || (block.timestamp >= (lastTokenTotalSupplyUpdate + ONE_YEAR))) {
            (address tokenAddress,) = tokenInfo();
            lastTokenTotalSupply = IERC20(tokenAddress).totalSupply();
            lastTokenTotalSupplyUpdate = block.timestamp;
            lastInflationPerDay = _calculatePercentage(lastTokenTotalSupply, lastTokenPercentage) / DAYS_IN_YEAR;
        }
    }

    function nextSwapToETHEvent() public view override returns(uint256) {
        return lastSwapToETHEvent == 0 ? 0 : (lastSwapToETHEvent + swapToETHInterval);
    }

    function destination() external override view returns(address destinationWalletOwner, address destinationWalletAddress, uint256 destinationWalletPercentage) {
        return (_destinationWalletOwner, _destinationWalletAddress, _destinationWalletPercentage);
    }

    function setDestination(address destinationWalletOwner, address destinationWalletAddress) external override returns (address oldDestinationWalletOwner, address oldDestinationWalletAddress) {
        require(msg.sender == _destinationWalletOwner);
        oldDestinationWalletOwner = _destinationWalletOwner;
        oldDestinationWalletAddress = _destinationWalletAddress;
        _destinationWalletOwner = destinationWalletOwner;
        _destinationWalletAddress = destinationWalletAddress;
    }

    function swapToETH(uint256 minAmount, address executorRewardReceiver) external override returns (uint256 executorReward, uint256 destinationAmount, uint256 treasurySplitterAmount) {
        require(block.timestamp >= nextSwapToETHEvent(), "Too early BRO");
        lastSwapToETHEvent = block.timestamp;

        updateInflationData();

        (uint256 value, address treasurySplitterAddress, address tokenAddress, address tokenReceiverAddress) = _receiveTokens();

        uint256 percentageToTransfer = _calculatePercentage(value, tokenReceiverPercentage);
        if(tokenReceiverAddress != address(0)) {
            tokenAddress.safeTransfer(tokenReceiverAddress, percentageToTransfer);
        } else {
            ERC20Burnable(tokenAddress).burn(percentageToTransfer);
        }
        value -= percentageToTransfer;

        require(minAmount > 0, "SLIPPPPPPPPPPPPPAGE");

        PrestoOperation[] memory prestoOperations = new PrestoOperation[](1);
        prestoOperations[0] = PrestoOperation({
            inputTokenAddress : tokenAddress,
            inputTokenAmount : value,
            ammPlugin : _ammPlugin,
            liquidityPoolAddresses : _liquidityPoolAddresses,
            swapPath : _swapPath,
            enterInETH : false,
            exitInETH : true,
            tokenMins : minAmount.asSingletonArray(),
            receivers : address(this).asSingletonArray(),
            receiversPercentages : new uint256[](0)
        });

        _receiving = true;
        treasurySplitterAmount = IPrestoUniV3(prestoAddress).execute(prestoOperations)[0];
        _receiving = false;

        address to = executorRewardReceiver != address(0) ? executorRewardReceiver : msg.sender;
        executorReward = _calculatePercentage(treasurySplitterAmount, executorRewardPercentage);
        address(0).safeTransfer(to, executorReward);
        treasurySplitterAmount -= executorReward;

        to = _destinationWalletAddress;
        if(to != address(0)) {
            destinationAmount = _calculatePercentage(treasurySplitterAmount, _destinationWalletPercentage);
            (bool result, ) = to.call{value : destinationAmount}("");
            if(result) {
                treasurySplitterAmount -= destinationAmount;
            }
        }

        to = treasurySplitterAddress;
        address(0).safeTransfer(to, treasurySplitterAmount);
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns(uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }

    function _receiveTokens() private returns(uint256 value, address ethReceiverAddress, address tokenAddress, address tokenReceiverAddress) {
        value = lastInflationPerDay;
        address tokenMinter;
        (tokenAddress, tokenMinter) = tokenInfo();
        IOSMinter(tokenMinter).mint(value, address(this));
        tokenAddress.safeApprove(prestoAddress, value);
        ethReceiverAddress = address(IOrganization(host).treasurySplitterManager());
        ethReceiverAddress = ethReceiverAddress != address(0) ? ethReceiverAddress : address(IOrganization(host).treasuryManager());
        tokenReceiverAddress = IOrganization(host).get(ComponentsGrimoire.COMPONENT_KEY_OS_FARMING);
    }
}