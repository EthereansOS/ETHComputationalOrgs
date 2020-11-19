import Web3 from 'web3';
import { EventEmitter } from 'events';
import { ContractOptions, EventData } from 'web3-eth-contract';
// @ts-ignore
import ContractBuild from '../../build/contracts/MVDProxy.json';
import { BaseContract } from '../models';

const { abi } = JSON.parse(ContractBuild);

export default class Proxy extends BaseContract {

    constructor(web3: Web3, address: string, options?: ContractOptions) {
        super(web3, address, abi, options);
    }
    
    /**
     * Returns an EventEmitter to listen for new Proposal Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the Proposal event retrieval.
     */
    getProposalEvents(filter?: any, fromBlock?: number | string): EventEmitter {
        if (!fromBlock) {
            fromBlock = "latest";
        }
        return this.instance.events.Proposal({ filter, fromBlock })
    }

    /**
     * Returns a list of EventData containing all the past Proposal events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastProposalEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[]> {
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
    
    /**
     * Returns an EventEmitter to listen for new ProposalCheck Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the ProposalCheck event retrieval.
     */
    getProposalCheckEvents(filter?: any, fromBlock?: number | string): EventEmitter {
        if (!fromBlock) {
            fromBlock = "latest";
        }
        return this.instance.events.ProposalCheck({ filter, fromBlock })
    }

    /**
     * Returns a list of EventData containing all the past ProposalCheck events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastProposalCheckEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[]> {
        try {
            if (!fromBlock) {
                fromBlock = 0;
            }
            if (!toBlock) {
                fromBlock = "latest";
            }
            const pastEvents = await this.instance.getPastEvents('ProposalCheck', { filter, fromBlock, toBlock });
            return pastEvents;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns an EventEmitter to listen for new ProposalSet Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the ProposalSet event retrieval.
     */
    getProposalSetEvents(filter?: any, fromBlock?: number | string): EventEmitter {
        if (!fromBlock) {
            fromBlock = "latest";
        }
        return this.instance.events.ProposalSet({ filter, fromBlock })
    }

    /**
     * Returns a list of EventData containing all the past ProposalSet events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastProposalSetEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[]> {
        try {
            if (!fromBlock) {
                fromBlock = 0;
            }
            if (!toBlock) {
                fromBlock = "latest";
            }
            const pastEvents = await this.instance.getPastEvents('ProposalSet', { filter, fromBlock, toBlock });
            return pastEvents;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns an EventEmitter to listen for new FunctionalitySet Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the FunctionalitySet event retrieval.
     */
    getFunctionalitySetEvents(filter?: any, fromBlock?: number | string): EventEmitter {
        if (!fromBlock) {
            fromBlock = "latest";
        }
        return this.instance.events.FunctionalitySet({ filter, fromBlock })
    }

    /**
     * Returns a list of EventData containing all the past FunctionalitySet events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastFunctionalitySetEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[]> {
        try {
            if (!fromBlock) {
                fromBlock = 0;
            }
            if (!toBlock) {
                fromBlock = "latest";
            }
            const pastEvents = await this.instance.getPastEvents('FunctionalitySet', { filter, fromBlock, toBlock });
            return pastEvents;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns an EventEmitter to listen for new Event Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the Event event retrieval.
     */
    getEvents(filter?: any, fromBlock?: number | string): EventEmitter {
        if (!fromBlock) {
            fromBlock = "latest";
        }
        return this.instance.events.Event({ filter, fromBlock })
    }

    /**
     * Returns a list of EventData containing all the past Event events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[]> {
        try {
            if (!fromBlock) {
                fromBlock = 0;
            }
            if (!toBlock) {
                fromBlock = "latest";
            }
            const pastEvents = await this.instance.getPastEvents('Event', { filter, fromBlock, toBlock });
            return pastEvents;
        } catch (error) {
            return error;
        }
    }
};