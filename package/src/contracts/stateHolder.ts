import Web3 from 'web3';
import { Contract, ContractOptions } from 'web3-eth-contract';
// @ts-ignore
import ContractBuild from '../../build/contracts/StateHolder.json';
import { ProxyDelegate } from '../models';

const { abi } = JSON.parse(ContractBuild);

export default class StateHolder extends ProxyDelegate {

    constructor(web3: Web3, address: string, options?: ContractOptions) {
        super(web3, address, abi, options);
    }

    /**
     * Returns the bytes value of the variable with the given name.
     * @param varName name of the variable.
     * @return variable value as string.
     */
    async getBytes(varName: string): Promise<string> {
        try {
            const result = await this.instance.methods.getBytes(varName).call();
            return result;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the string value of the variable with the given name.
     * @param varName name of the variable.
     * @return variable value as string.
     */
    async getString(varName: string): Promise<string> {
        try {
            const result = await this.instance.methods.getString(varName).call();
            return result;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the boolean value of the variable with the given name.
     * @param varName name of the variable.
     * @return variable value as boolean.
     */
    async getBool(varName: string): Promise<boolean> {
        try {
            const result = await this.instance.methods.getBool(varName).call();
            return result;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the uint256 value of the variable with the given name.
     * @param varName name of the variable.
     * @return variable value as uint256.
     */
    async getUint256(varName: string): Promise<number> {
        try {
            const result = await this.instance.methods.getUint256(varName).call();
            return result;
        } catch (error) {
            return error;
        }
    }
    
    /**
     * Returns the address value of the variable with the given name.
     * @param varName name of the variable.
     * @return variable value as address.
     */
    async getAddress(varName: string): Promise<string> {
        try {
            const result = await this.instance.methods.getAddress(varName).call();
            return result;
        } catch (error) {
            return error;
        }
    }
};