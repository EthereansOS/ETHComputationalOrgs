import Web3 from "web3";
import { Contract, ContractOptions } from 'web3-eth-contract';

class BaseContract {
    instance: Contract;
    address: string;
    web3: Web3;

    constructor(web3: Web3, address: string, abi?: any, options?: ContractOptions) {
        this.web3 = web3;
        this.address = address;
        this.instance = new web3.eth.Contract(abi, address, options);
    }
}

class ProxyDelegate extends BaseContract {

    constructor(web3: Web3, address: string, abi?: any, options?: ContractOptions) {
        super(web3, address, abi, options);
    }

    /**
     * Returns the proxy address for this contract.
     * @return proxy address for this contract.
     */
    async getProxy(): Promise<string> {
        try {
            const proxyAddress = await this.instance.methods.getProxy().call();
            return proxyAddress;
        } catch (error) {
            return error;
        }
    }
    
}

export { BaseContract, ProxyDelegate };