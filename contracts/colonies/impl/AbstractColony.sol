// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../model/IColony.sol";
import "@ethereansos/swissknife/contracts/generic/impl/LazyInitCapableElement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { TransferUtilities } from "@ethereansos/swissknife/contracts/lib/GeneralUtilities.sol";

interface WETH is IERC20 {

    function deposit() external payable;

    function withdraw(uint wad) external;
}

abstract contract AbstractColony is IColony, LazyInitCapableElement {
    using TransferUtilities for address;

    mapping(address => bool) public isWeth;
    address public receiverResolver;
    uint256 public executorRewardPercentage;

    constructor(bytes memory data) LazyInitCapableElement(data) {
    }

    receive() external payable {}

    function sendTokens(address[] memory tokenAddresses, uint32[] memory l1GasArray, address _rewardReceiver) external override {
        if(tokenAddresses.length == 0) {
            return;
        }
        address to = resolveReceiver();
        address rewardReceiver = _rewardReceiver != address(0) ?_rewardReceiver : msg.sender;

        bool sendETH = false;

        for(uint256 i = 0; i < tokenAddresses.length; i++) {
            address tokenAddress = tokenAddresses[i];
            uint32 l1Gas = l1GasArray.length == 0 ? 0 : i < l1GasArray.length ? l1GasArray[i] : l1GasArray[0];
            if(tokenAddress == address(0) || isWeth[tokenAddress]) {
                bool result = _tryUnwrapWETH(tokenAddress);
                sendETH = sendETH || result;
            } else {
                _send(tokenAddress, to, IERC20(tokenAddress).balanceOf(address(this)), rewardReceiver, l1Gas, "");
            }
        }

        if(sendETH) {
            uint256 balance = address(this).balance;
            if(balance > 0) {
                _send(address(0), to, balance, rewardReceiver, 0, "");
            }
        }

        emit ColonyTransfer();
    }

    function _lazyInit(bytes memory data) internal override returns(bytes memory lazyInitResponse) {
        require(receiverResolver == address(0), "init");
        address[] memory _wethAddresses;
        (_wethAddresses, receiverResolver, executorRewardPercentage, lazyInitResponse) = abi.decode(data, (address[], address, uint256, bytes));
        for(uint256 i = 0; i < _wethAddresses.length; i++) {
            address wethAddress = _wethAddresses[i];
            if(wethAddress != address(0)) {
                isWeth[wethAddress] = true;
            }
        }
        lazyInitResponse = _colonyLazyInit(lazyInitResponse);
    }

    function _colonyLazyInit(bytes memory) internal virtual returns(bytes memory) {
    }

    function _tryUnwrapWETH(address wethAddress) private returns (bool sendETH) {
        if(wethAddress == address(0)) {
            return true;
        }
        uint256 balance = IERC20(wethAddress).balanceOf(address(this));
        if(sendETH = balance > 0) {
            WETH(wethAddress).withdraw(balance);
        }
    }

    function _send(address tokenAddress, address to, uint256 value, address rewardReceiver, uint32 l1Gas, bytes memory payload) private {
        (uint256 amount, uint256 executorReward) = _calculateExecutorReward(value);
        if(amount == 0) {
            return;
        }
        _send(tokenAddress, to, amount, executorReward, rewardReceiver, l1Gas, payload);
    }

    function _calculateExecutorReward(uint256 value) private view returns(uint256 amount, uint256 executorReward) {
        uint256 rewardPercentage = executorRewardPercentage;
        if((amount = value) != 0 && rewardPercentage != 0) {
            executorReward = (amount * ((rewardPercentage * 1e18) / 1e18)) / 1e18;
            amount = amount - executorReward;
        }
    }

    function resolveReceiver() public virtual view returns(address) {
        return receiverResolver;
    }

    function _send(address token, address to, uint256 amount, uint256 executorReward, address rewardReceiver, uint32, bytes memory) internal virtual {
        token.safeTransfer(rewardReceiver, executorReward);
        token.safeTransfer(to, amount);
    }

    function _supportsInterface(bytes4 selector) internal override pure returns (bool) {
        return selector == type(IColony).interfaceId || selector == this.sendTokens.selector;
    }
}