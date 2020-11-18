import Web3 from 'web3';
import { Contract, ContractOptions } from 'web3-eth-contract';
// @ts-ignore
import ContractBuild from '../../build/contracts/VotingToken.json';
import { ProxyDelegate } from '../models';

const { abi } = JSON.parse(ContractBuild);

export default class VotingToken extends ProxyDelegate {

    constructor(web3: Web3, address: string, options?: ContractOptions) {
        super(web3, address, abi, options);
    }
    
};