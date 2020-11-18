import Web3 from "web3";
import { Contract, ContractOptions } from 'web3-eth-contract';

class BaseContract {
    instance: Contract;
    address: string;

    constructor(web3: Web3, address: string, abi?: any, options?: ContractOptions) {
        this.address = address;
        this.instance = new web3.eth.Contract(abi, address, options);
    }
}

export { BaseContract };