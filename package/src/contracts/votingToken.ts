import Web3 from 'web3';
import { Contract, ContractOptions } from 'web3-eth-contract';
// @ts-ignore
import ContractBuild from '../../build/contracts/VotingToken.json';

const { abi } = JSON.parse(ContractBuild);

export default class VotingToken {
    instance: Contract;
    address: string;

    constructor(web3: Web3, address: string, options?: ContractOptions) {
        this.address = address;
        this.instance = new web3.eth.Contract(abi, address, options);
    }
};