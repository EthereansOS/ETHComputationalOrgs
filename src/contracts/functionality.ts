import Web3 from 'web3';
import { Contract, ContractOptions, SendOptions } from 'web3-eth-contract';
// @ts-ignore
import ContractBuild from '../../build/contracts/Functionality.json';

const { abi, bytecode } = JSON.parse(ContractBuild);

export default class Functionality {
    instance: Contract;
    address: string;

    constructor(web3: Web3, address: string, options?: ContractOptions) {
        this.address = address;
        this.instance = new web3.eth.Contract(abi, address, options);
    }

    /**
     * Deploys a new Functionality contract and returns its class representation.
     * @param web3 Web3 instance.
     * @param sendOptions contract send options.
     * @param deployArgs deploy arguments.
     */
    static async deploy(web3: Web3, sendOptions: SendOptions, deployArgs?: any[]): Promise<Functionality> {
        return new Promise(async (resolve, reject) => {
            try {
                const deployContract = new web3.eth.Contract(abi);
                const contract = await deployContract.deploy({ data: bytecode, arguments: deployArgs }).send(sendOptions);
                const functionality = new Functionality(web3, contract.options.address);
                resolve(functionality);
            } catch (error) {
                reject(error);
            }
        });
    }
};