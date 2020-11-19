import Web3 from 'web3';
import { EventEmitter } from "events";
import { ContractOptions, EventData } from 'web3-eth-contract';
// @ts-ignore
import ContractBuild from '../../build/contracts/MVDWallet.json';
import { ProxyDelegate } from '../models';

const { abi } = JSON.parse(ContractBuild);

export default class Wallet extends ProxyDelegate {

    constructor(web3: Web3, address: string, options?: ContractOptions) {
        super(web3, address, abi, options);
    }
    /**
     * Returns an EventEmitter to listen for new OrchestratorChanged Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the OrchestratorChanged event retrieval.
     */
    getOrchestratorChangedEvents(filter?: any, fromBlock?: number | string): EventEmitter {
        if (!fromBlock) {
            fromBlock = "latest";
        }
        return this.instance.events.OrchestratorChanged({ filter, fromBlock })
    }

    /**
     * Returns a list of EventData containing all the past OrchestratorChanged events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastOrchestratorChangedEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[]> {
        try {
            if (!fromBlock) {
                fromBlock = 0;
            }
            if (!toBlock) {
                fromBlock = "latest";
            }
            const pastEvents = await this.instance.getPastEvents('Proposal', { filter, fromBlock, toBlock });
            return pastEvents;
        } catch (error) {
            return error;
        }
    }
};