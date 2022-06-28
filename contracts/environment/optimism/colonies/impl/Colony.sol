// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import "../../../../colonies/impl/AbstractColony.sol";

interface IL2ERC20Bridge {
    function withdrawTo(
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l1Gas,
        bytes calldata _data
    ) external;
}

interface IL2StandardERC20 {
    function l1Token() external view returns (address);
}

contract Colony is AbstractColony {
    using TransferUtilities for address;

    address private constant L2_STANDARD_BRIDGE = 0x4200000000000000000000000000000000000010;
    address payable private constant OVM_ETH = payable(0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000);

    constructor(bytes memory data) AbstractColony(data) {
    }

    function _send(address token, address to, uint256 amount, uint256 executorReward, address rewardReceiver, uint32 l1Gas, bytes memory payload) internal override {
        if(msg.sender == host) {
            token.safeTransfer(rewardReceiver, amount + executorReward);
        } else {
            token.safeTransfer(rewardReceiver, executorReward);
            _transferToL1(token, to, amount, l1Gas, payload);
        }
    }

    function _transferToL1(address erc20TokenAddress, address to, uint256 value, uint32 l1Gas, bytes memory payload) private {
        if(value == 0) {
            return;
        }
        IL2ERC20Bridge(L2_STANDARD_BRIDGE).withdrawTo(
            erc20TokenAddress == address(0) ? OVM_ETH : erc20TokenAddress,
            to,
            value,
            l1Gas,
            payload
        );
    }
}