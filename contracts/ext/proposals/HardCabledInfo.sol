// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

abstract contract HardCabledInfo {

    bytes32 private immutable _label;
    bytes32 private immutable _uri0;
    bytes32 private immutable _uri1;
    bytes32 private immutable _uri2;
    bytes32 private immutable _uri3;
    bytes32 private immutable _uri4;

    constructor(bytes32[] memory strings) {
        _label = strings[0];
        _uri0 = strings[1];
        _uri1 = strings[2];
        _uri2 = strings[3];
        _uri3 = strings[4];
        _uri4 = strings[5];
    }

    function LABEL() external view returns(string memory) {
        return _asString(_label);
    }

    function uri() external view returns(string memory) {
        return string(abi.encodePacked(
            _asString(_uri0),
            _asString(_uri1),
            _asString(_uri2),
            _asString(_uri3),
            _asString(_uri4)
        ));
    }

    function _asString(bytes32 value) private pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && value[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && value[i] != 0; i++) {
            bytesArray[i] = value[i];
        }
        return string(bytesArray);
    }
}

abstract contract LazyInitCapableHardCabledInfo is HardCabledInfo {

    address private _initializer;

    constructor(bytes32[] memory strings, bytes memory lazyInitData) HardCabledInfo(strings) {
        if(lazyInitData.length != 0) {
            __lazyInit(lazyInitData);
        }
    }

    function lazyInit(bytes memory lazyInitData) external returns(bytes memory lazyInitResponseData) {
        return __lazyInit(lazyInitData);
    }

    function initializer() external view returns(address) {
        return _initializer;
    }

    function __lazyInit(bytes memory lazyInitData) private returns(bytes memory lazyInitResponseData) {
        require(_initializer == address(0));
        _initializer = msg.sender;
        return _lazyInit(lazyInitData);
    }

    function _lazyInit(bytes memory lazyInitData) internal virtual returns(bytes memory lazyInitResponseData);
}