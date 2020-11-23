pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./interfaces/IMVDProxy.sol";
import "./CommonUtilities.sol";
import "./interfaces/IStateHolder.sol";
import "./interfaces/IMVDFunctionalitiesManager.sol";

contract StateHolder is IStateHolder, CommonUtilities {

    // Defines the different data types that can be stored
    enum DataType {
        ADDRESS,
        BOOL,
        BYTES,
        STRING,
        UINT256
    }

    // Defines the values stored in the StateHolder
    struct Var {
        string name;
        DataType dataType;
        bytes value;
        bool active;
    }

    // _state contains all the variables and their associated index
    mapping(uint256 => Var) private _state;
    // _stateIndex contains the mapping varname/_state index
    mapping(string => uint256) private _stateIndex;
    // _stateSize contains the size of our state
    uint256 private _stateSize;
    // _proxy contains the proxy address
    address private _proxy;

    constructor() public {
    }

    modifier canSet {
        if (_proxy != address(0)) {
            require(IMVDProxy(_proxy).isAuthorizedFunctionality(msg.sender), "UnauthorizedAccess");
        }
        _;
    }

    /** @dev Sets the input Var element inside the storage. 
      * @param element new element to set or add to the storage.
      * @return oldVal overwritten element value or "".
      */
    function setVal(Var memory element) private returns(bytes memory oldVal) {
        // Check if the element name is empty
        if (compareStrings(element.name, "")) {
            return "";
        }
        // Check if the element already exists
        if (exists(element.name)) {
            Var memory oldElement = _state[_stateIndex[element.name]];
            require(element.dataType == oldElement.dataType, "Invalid dataType provided");
            oldVal = oldElement.value;
            oldElement.value = element.value;
            _state[_stateIndex[element.name]] = oldElement;
        } else {
            _state[_stateSize] = element;
            _stateIndex[element.name] = _stateSize;
            _stateSize++;
            return "";
        }
    }

    /** @dev Sets the input array of variables in the state.
      * @param variables array of new variables.
      * @return array of old variables value is overwritten.
      */
    function batchSetVal(InputVar[] memory variables) public override canSet returns(bytes[] memory) {
        bytes[] memory result = new bytes[](variables.length);
        for (uint256 i = 0; i < variables.length; i++) {
            result[i] = setVal(Var(variables[i].name, toDataType(variables[i].dataType), variables[i].value, true));
        }
    }

    /** @dev Clears the Var element with the input varName.
      * @param varName name of the variable to clear.
      * @return oldDataType old element data type.
      * @return oldVal old element value or "".
      */
    function clear(string memory varName) public override canSet returns(string memory oldDataType, bytes memory oldVal) {
        Var storage variable = _state[_stateIndex[varName]];
        if (compareStrings(varName, variable.name) && variable.active) {
            oldDataType = toString(variable.dataType);
            oldVal = variable.value;
            Var memory lastElement = _state[_stateSize];
            _state[_stateIndex[varName]] = lastElement;
            _stateIndex[lastElement.name] = _stateIndex[varName];
            delete _stateIndex[varName];
            _stateSize--;
        }
    }

    /** @dev Private version of the clear function used for gas purposes.
      * @param varName name of the variable to clear.
      * @return oldDataType old element data type.
      * @return oldVal old element value or "".
      */
    function _clear(string memory varName) private returns(string memory oldDataType, bytes memory oldVal) {
        Var storage variable = _state[_stateIndex[varName]];
        if (compareStrings(varName, variable.name) && variable.active) {
            oldDataType = toString(variable.dataType);
            oldVal = variable.value;
            Var memory lastElement = _state[_stateSize];
            _state[_stateIndex[varName]] = lastElement;
            _stateIndex[lastElement.name] = _stateIndex[varName];
            delete _stateIndex[varName];
            _stateSize--;
        }
    }

    /** @dev Clears all the variables corresponding to the input uint256 array of indexes.
      * @param varIndexes array containing the indexes of the variables to delete.
      */
    function batchClear(uint256[] memory varIndexes) public override canSet {
        for (uint256 i = 0; i < varIndexes.length; i++) {
            _clear(_state[varIndexes[i]].name);
        }
    }

    /** @dev Returns the current storage size as uint256.
      * @return the current storage size.
      */
    function getStateSize() public override view returns (uint256) {
        return _stateSize;
    }

    /** @dev Returns true if the variable with the given varName exists, false otherwise.
      * @param varName name of the variable to check.
      * @return true if the variable exists, false otherwise.
      */
    function exists(string memory varName) public override view returns(bool) {
        return _state[_stateIndex[varName]].active;
    }

    /** @dev Calls the helper method for building the storage full JSON string.
      * @return JSON array string representation of the storage.
      */
    function toJSON() public override view returns(string memory) {
        return toJSON(0, _stateSize - 1);
    }

    /** @dev Builds a JSON array string from the start index to the end index.
      * @param start start index (eg. 0)
      * @param end end index (eg. _stateSize - 1)
      * @return json JSON array string representation of the storage from start to end indexes.
      */
    function toJSON(uint256 start, uint256 end) public override view returns(string memory json) {
        uint256 length = start + end + 1;
        json = "[";
        for (uint256 i = start; i < length; i++) {
            json = !(_state[i].active) ? json : string(abi.encodePacked(json, '{"name":"', _state[i].name, '","type":"', toString(_state[i].dataType), '"}', i == length - (_state[i].active ? 1 : 0) ? "" : ","));
            length += (_state[i].active) ? 0 : 1;
            length = (length > _stateSize) ? _stateSize : length;
        }
        json = string(abi.encodePacked(json, ']'));
    }

    /** @dev Sets a new variable with dataType "bytes".
      * @param varName new variable name.
      * @param val new variable value
      * @return old variable value if overwritten.
      */
    function setBytes(string memory varName, bytes memory val) public canSet override returns(bytes memory) {
        return setVal(Var(varName, DataType.BYTES, val, true));
    }

    /** @dev Returns the value of the variable with the given name as bytes.
      * @param varName variable name used to retrieve the value.
      * @return variable value.
      */
    function getBytes(string memory varName) public override view returns(bytes memory) {
        return _state[_stateIndex[varName]].value;
    }

    /** @dev Sets a new variable with dataType "string".
      * @param varName new variable name.
      * @param val new variable value
      * @return old variable value if overwritten, false otherwise.
      */
    function setString(string memory varName, string memory val) public canSet override returns(string memory) {
        return string(setVal(Var(varName, DataType.STRING, bytes(val), true)));
    }

    /** @dev Returns the value of the variable with the given name as string.
      * @param varName variable name used to retrieve the value.
      * @return variable value.
      */
    function getString(string memory varName) public override view returns (string memory) {
        return string(_state[_stateIndex[varName]].value);
    }

    /** @dev Sets a new variable with dataType "bool".
      * @param varName new variable name.
      * @param val new variable value
      * @return old variable value if overwritten, false otherwise.
      */
    function setBool(string memory varName, bool val) public canSet override returns(bool) {
        return toUint256(setVal(Var(varName, DataType.BOOL, abi.encode(val ? 1 : 0), true))) == 1;
    }

    /** @dev Returns the value of the variable with the given name as bool.
      * @param varName variable name used to retrieve the value.
      * @return variable value.
      */
    function getBool(string memory varName) public override view returns (bool) {
        return toUint256(_state[_stateIndex[varName]].value) == 1;
    }

    /** @dev Sets a new variable with dataType "uint256".
      * @param varName new variable name.
      * @param val new variable value
      * @return old variable value if overwritten, false otherwise.
      */
    function setUint256(string memory varName, uint256 val) public canSet override returns(uint256) {
        return toUint256(setVal(Var(varName, DataType.UINT256, abi.encode(val), true)));
    }

    /** @dev Returns the value of the variable with the given name as uint256.
      * @param varName variable name used to retrieve the value.
      * @return variable value.
      */
    function getUint256(string memory varName) public override view returns (uint256) {
        return toUint256(_state[_stateIndex[varName]].value);
    }

    /** @dev Sets a new variable with dataType "address".
      * @param varName new variable name.
      * @param val new variable value
      * @return old variable value if overwritten, false otherwise.
      */
    function setAddress(string memory varName, address val) public canSet override returns (address) {
        return toAddress(setVal(Var(varName, DataType.ADDRESS, abi.encodePacked(val), true)));
    }

    /** @dev Returns the value of the variable with the given name as address.
      * @param varName variable name used to retrieve the value.
      * @return variable value.
      */
    function getAddress(string memory varName) public override view returns (address) {
        return toAddress(_state[_stateIndex[varName]].value);
    }

    /** @dev Sets the StateHolder proxy address.
      */
    function setProxy() public override {
        require(_proxy == address(0) || _proxy == msg.sender, _proxy != address(0) ? "Proxy already set!" : "Only Proxy can toggle itself!");
        _proxy = _proxy == address(0) ?  msg.sender : address(0);
    }

    /** @dev Returns the proxy address for this contract.
      * @return state holder proxy address.
      */
    function getProxy() public override view returns (address) {
        return _proxy;
    }

    /** @dev Converts the DataType Enum to a string.
      * @param dataType data type enum to convert.
      * @return data type as string
      */
    function toString(DataType dataType) private pure returns (string memory) {
        return
            dataType == DataType.ADDRESS ? "address" :
            dataType == DataType.BOOL ? "bool" :
            dataType == DataType.BYTES ? "bytes" :
            dataType == DataType.STRING ? "string" :
            dataType == DataType.UINT256 ? "uint256" :
            "";
    }

    /** @dev Converts a string into the DataType Enum.
      * @param dataType data type string to convert.
      * @return data type as enum.
      */
    function toDataType(string memory dataType) private pure returns (DataType) {
        return
            compareStrings(dataType, "address") ? DataType.ADDRESS :
            compareStrings(dataType, "bool") ? DataType.BOOL :
            compareStrings(dataType, "string") ? DataType.STRING :
            compareStrings(dataType, "uint256") ? DataType.UINT256 :
            DataType.BYTES;
    }
}