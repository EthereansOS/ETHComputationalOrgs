// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IInvestmentsManager.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import { ReflectionUtilities, TransferUtilities, Uint256Utilities, AddressUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";
import { Getters } from "../../../base/lib/KnowledgeBase.sol";
import "../../../core/model/IOrganization.sol";
import "../../../base/model/ITreasuryManager.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract InvestmentsManager is IInvestmentsManager, LazyInitCapableElement {
    using ReflectionUtilities for address;
    using Uint256Utilities for uint256;
    using AddressUtilities for address;
    using Getters for IOrganization;
    using TransferUtilities for address;

    uint256 public constant override ONE_HUNDRED = 1e18;

    bytes32 private _organizationComponentKey;

    uint256 public override executorRewardPercentage;

    address public override prestoAddress;

    PrestoOperation[] private _tokensFromETHOperations;

    uint256 public override lastSwapToETHEvent;
    uint256 public override swapToETHInterval;

    PrestoOperation[] private _tokensToETHOperations;

    constructor(bytes memory lazyInitData) LazyInitCapableElement(lazyInitData) {
    }

    function _lazyInit(bytes memory lazyInitData) internal override virtual returns (bytes memory lazyInitResponse) {
        uint256 firstSwapToETHEvent;
        uint256 _swapToETHInterval;
        (_organizationComponentKey, executorRewardPercentage, prestoAddress, firstSwapToETHEvent, _swapToETHInterval, lazyInitResponse) = abi.decode(lazyInitData, (bytes32, uint256, address, uint256, uint256, bytes));
        swapToETHInterval = _swapToETHInterval;
        if(firstSwapToETHEvent != 0 && _swapToETHInterval < firstSwapToETHEvent) {
            lastSwapToETHEvent = firstSwapToETHEvent - _swapToETHInterval;
        }
        _initOperations(lazyInitResponse);
        lazyInitResponse = "";
    }

    function _supportsInterface(bytes4 interfaceId) internal override pure returns(bool) {
        return
            interfaceId == type(IInvestmentsManager).interfaceId ||
            interfaceId == this.ONE_HUNDRED.selector ||
            interfaceId == this.refundETHReceiver.selector ||
            interfaceId == this.executorRewardPercentage.selector ||
            interfaceId == this.prestoAddress.selector ||
            interfaceId == this.tokensFromETH.selector ||
            interfaceId == this.setTokensFromETH.selector ||
            interfaceId == this.swapFromETH.selector ||
            interfaceId == this.lastSwapToETHEvent.selector ||
            interfaceId == this.swapToETHInterval.selector ||
            interfaceId == this.nextSwapToETHEvent.selector ||
            interfaceId == this.tokensToETH.selector ||
            interfaceId == this.setTokensToETH.selector ||
            interfaceId == this.swapToETH.selector;
    }

    receive() external payable {
    }

    function refundETHReceiver() public override view returns(bytes32 key, address receiverAddress) {
        key = _organizationComponentKey;
        receiverAddress = IOrganization(host).get(key);
        receiverAddress != address(0) ? receiverAddress : address(IOrganization(host).treasuryManager());
    }

    function tokensFromETH() override external view returns(PrestoOperation[] memory tokensFromETHOperations) {
        return _tokensFromETHOperations;
    }

    function setTokensFromETH(PrestoOperation[] calldata tokensFromETHOperations) external override authorizedOnly returns(PrestoOperation[] memory oldTokensFromETHOperations) {
        oldTokensFromETHOperations = _tokensFromETHOperations;
        delete _tokensFromETHOperations;
        for(uint256 i = 0; i < tokensFromETHOperations.length; i++) {
            PrestoOperation memory operation = tokensFromETHOperations[i];
            require(operation.inputTokenAddress == address(0), "zero");
            require(operation.swapPath[operation.swapPath.length - 1] != address(0), "zero");
            _tokensFromETHOperations.push(operation);
        }
    }

    function swapFromETH(uint256[] memory minAmounts, address executorRewardReceiver) external override returns (uint256[] memory tokenAmounts, uint256 executorReward) {

        uint256 ethBalance = address(this).balance;

        require(ethBalance > 0, "No ETH");

        address[] memory receivers;

        (ethBalance, executorReward, receivers) = _receiveETH(ethBalance, executorRewardReceiver);

        uint256 length = _tokensFromETHOperations.length;

        PrestoOperation[] memory prestoOperations = new PrestoOperation[](length);

        uint256 splittedBalance = ethBalance / length;

        require(splittedBalance != 0, "No enough ETH");

        uint256 lastBalance = ethBalance - (splittedBalance * (length - 1));

        for(uint256 i = 0; i < length; i++) {
            PrestoOperation memory inputOperation = _tokensFromETHOperations[i];
            require(minAmounts[i] > 0, "SLIPPPPPPPPPPPPPAGE");
            prestoOperations[i] = PrestoOperation({
                inputTokenAddress : address(0),
                inputTokenAmount : i == (length - 1) ? lastBalance : splittedBalance,
                ammPlugin : inputOperation.ammPlugin,
                liquidityPoolAddresses : inputOperation.liquidityPoolAddresses,
                swapPath : inputOperation.swapPath,
                enterInETH : true,
                exitInETH : false,
                tokenMins : minAmounts[i].asSingletonArray(),
                receivers : inputOperation.receivers.length > 0 ? receivers : (address(0)).asSingletonArray(),
                receiversPercentages : new uint256[](0)
            });
        }

        tokenAmounts = IPrestoUniV3(prestoAddress).execute{ value : ethBalance }(prestoOperations);
    }

    function nextSwapToETHEvent() public view override returns(uint256) {
        return lastSwapToETHEvent == 0 ? 0 : (lastSwapToETHEvent + swapToETHInterval);
    }

    function tokensToETH() external view override returns(PrestoOperation[] memory tokensToETHOperations) {
        return _tokensToETHOperations;
    }

    function setTokensToETH(PrestoOperation[] memory tokensToETHOperations) external override authorizedOnly returns(PrestoOperation[] memory oldTokensToETHOperations) {
        oldTokensToETHOperations = _tokensToETHOperations;
        delete _tokensToETHOperations;
        for(uint256 i = 0; i < tokensToETHOperations.length; i++) {
            PrestoOperation memory operation = tokensToETHOperations[i];
            require(operation.inputTokenAddress != address(0), "zero");
            require(operation.swapPath[operation.swapPath.length - 1] == address(0), "zero");
            _tokensToETHOperations.push(operation);
        }
    }

    function swapToETH(uint256[] memory minAmounts, address executorRewardReceiver) external override returns (uint256[] memory ETHAmounts, uint256[] memory executorRewards) {

        require(_tokensToETHOperations.length > 0, "no tokens");

        require(block.timestamp >= nextSwapToETHEvent(), "Too early BRO");
        lastSwapToETHEvent = block.timestamp;

        (uint256[] memory values, address[] memory receivers, uint256[] memory receiversPercentages, uint256 operationsLength) = _receiveTokens(executorRewardReceiver);
        require(operationsLength > 0, "no operations");
        PrestoOperation[] memory prestoOperations = new PrestoOperation[](operationsLength);

        uint256 index = 0;
        for(uint256 i = 0; i < values.length; i++) {
            if(values[i] == 0) {
                continue;
            }
            PrestoOperation memory inputOperation = _tokensToETHOperations[i];
            require(minAmounts[i] > 0, "SLIPPPPPPPPPPPPPAGE");
            inputOperation.swapPath[inputOperation.swapPath.length - 1] = address(0);
            prestoOperations[index++] = PrestoOperation({
                inputTokenAddress : inputOperation.inputTokenAddress,
                inputTokenAmount : values[i],
                ammPlugin : inputOperation.ammPlugin,
                liquidityPoolAddresses : inputOperation.liquidityPoolAddresses,
                swapPath : inputOperation.swapPath,
                enterInETH : false,
                exitInETH : true,
                tokenMins : minAmounts[i].asSingletonArray(),
                receivers : receivers,
                receiversPercentages : receiversPercentages
            });
        }

        ETHAmounts = IPrestoUniV3(prestoAddress).execute(prestoOperations);

        ETHAmounts = _normalizeETHAmounts(ETHAmounts, values);

        executorRewards = new uint256[](ETHAmounts.length);
        uint256 percentage = executorRewardPercentage;
        if(percentage > 0) {
            for(uint256 i = 0; i < executorRewards.length; i++) {
                executorRewards[i] = _calculatePercentage(ETHAmounts[i], percentage);
            }
        }
    }

    function flushToWallet(address[] calldata tokenAddresses) external override authorizedOnly returns(uint256[] memory amounts) {
        address destination = address(IOrganization(host).treasuryManager());
        amounts = new uint256[](tokenAddresses.length);
        for(uint256 i = 0; i < tokenAddresses.length; i++) {
            tokenAddresses[i].safeTransfer(destination, amounts[i] = tokenAddresses[i].balanceOf(address(this)));
        }
    }

    function _initOperations(bytes memory lazyInitData) private {
        if(lazyInitData.length == 0) {
            return;
        }
        PrestoOperation[] memory operations = abi.decode(lazyInitData, (PrestoOperation[]));
        for(uint256 i = 0; i < operations.length; i++) {
            PrestoOperation memory operation = operations[i];
            if(operation.inputTokenAddress == address(0)) {
                _tokensFromETHOperations.push(operation);
            } else {
                _tokensToETHOperations.push(operation);
            }
        }
    }

    function _calculatePercentage(uint256 totalSupply, uint256 percentage) private pure returns(uint256) {
        return (totalSupply * ((percentage * 1e18) / ONE_HUNDRED)) / 1e18;
    }

    function _receiveETH(uint256 ethBalanceInput, address executorRewardReceiver) private returns(uint256 ethBalance, uint256 executorReward, address[] memory receivers) {
        ethBalance = ethBalanceInput;
        receivers = address(this).asSingletonArray();
        if(executorRewardPercentage > 0) {
            executorReward = _calculatePercentage(ethBalance, executorRewardPercentage);
            address receiver = executorRewardReceiver != address(0) ? executorRewardReceiver : msg.sender;
            address(0).safeTransfer(receiver, executorReward);
            ethBalance -= executorReward;
        }
    }

    function _receiveTokens(address executorRewardReceiver) private returns(uint256[] memory values, address[] memory receivers, uint256[] memory receiverPercentages, uint256 operationsLength) {
        uint256 length = _tokensToETHOperations.length;
        values = new uint256[](length);
        for(uint256 i = 0; i < length; i++) {
            PrestoOperation memory operation = _tokensToETHOperations[i];
            address tokenAddress = operation.inputTokenAddress;
            values[i] = _calculatePercentage(IERC20(tokenAddress).balanceOf(address(this)), operation.inputTokenAmount);
            if(values[i] > 0) {
                operationsLength++;
                tokenAddress.safeApprove(prestoAddress, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
            }
        }
        (,address refundETHReceiverAddress) = refundETHReceiver();
        if(executorRewardPercentage > 0) {
            receivers = new address[](2);
            receivers[0] = executorRewardReceiver != address(0) ? executorRewardReceiver : msg.sender;
            receivers[1] = refundETHReceiverAddress;
            receiverPercentages = new uint256[](1);
            receiverPercentages[0] = executorRewardPercentage;
        } else {
            receivers = refundETHReceiverAddress.asSingletonArray();
        }
    }

    function _normalizeETHAmounts(uint256[] memory ETHAmounts, uint256[] memory values) private pure returns(uint256[] memory normalizedETHAmounts) {
        if(ETHAmounts.length == values.length) {
            return ETHAmounts;
        }
        normalizedETHAmounts = new uint256[](values.length);
        uint256 index = 0;
        for(uint256 i = 0; i < normalizedETHAmounts.length; i++) {
            if(values[i] == 0) {
                continue;
            }
            normalizedETHAmounts[i] = ETHAmounts[index++];
        }
    }
}