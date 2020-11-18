import Web3 from 'web3';
import { EventEmitter } from 'events';
import { ContractOptions, EventData } from 'web3-eth-contract';
import { 
    DoubleProxy, 
    FunctionalitiesManager, 
    FunctionalityModelsManager, 
    FunctionalityProposalManager, 
    Proxy, 
    StateHolder, 
    VotingToken, 
    Wallet 
} from '../contracts';

interface ETHComputationalOrgOptions {
    doubleProxy?: ETHComputationalOrgContractOptions, // double proxy options
    functionalitiesManager?: ETHComputationalOrgContractOptions, // functionalities manager options
    functionalityModelsManager?: ETHComputationalOrgContractOptions, // functionality models manager options
    functionalityProposalManager?: ETHComputationalOrgContractOptions, // functionality proposal manager options
    proxy?: ETHComputationalOrgContractOptions, // proxy options
    stateHolder?: ETHComputationalOrgContractOptions, // state holder options
    votingToken?: ETHComputationalOrgContractOptions, // voting token options
    wallet?: ETHComputationalOrgContractOptions, // wallet options
}

interface ETHComputationalOrgContractOptions {
    address: string, // contract address
    options?: ContractOptions, // contract options
}

export default class ETHComputationalOrg {
    private web3: Web3;
    doubleProxyAddress: string = "";
    doubleProxy: DoubleProxy | null = null;
    functionalitiesManagerAddress: string = "";
    functionalitiesManager: FunctionalitiesManager | null = null;
    functionalityModelsManagerAddress: string = "";
    functionalityModelsManager: FunctionalityModelsManager | null = null;
    functionalityProposalManagerAddress: string = "";
    functionalityProposalManager: FunctionalitiesManager | null = null;
    proxyAddress: string = "";
    proxy: Proxy | null = null;
    stateHolderAddress: string = "";
    stateHolder: StateHolder | null = null;
    votingTokenAddress: string = "";
    votingToken: VotingToken | null = null;
    walletAddress: string = "";
    wallet: Wallet | null = null;

    /**
     * Creates a new instance of a EthComputationalOrg using the input web3 instance.
     * It accepts some options to initialize all the contracts in the constructor.
     * @param web3 web3 instance.
     * @param options initialization options.
     */
    constructor(web3: Web3, options?: ETHComputationalOrgOptions) {
        this.web3 = web3;
        // Check if options are provided
        if (options) {
            // If doubleProxy options are provided, setup the contract
            if (options.doubleProxy) {
                this.doubleProxyAddress = options.doubleProxy.address;
                this.doubleProxy = new DoubleProxy(this.web3, this.doubleProxyAddress, options.doubleProxy.options);
            }
            // If functionalitiesManager options are provided, setup the contract
            if (options.functionalitiesManager) {
                this.functionalitiesManagerAddress = options.functionalitiesManager.address;
                this.functionalitiesManager = new FunctionalitiesManager(this.web3, this.functionalitiesManagerAddress, options.functionalitiesManager.options);
            }
            // If functionalityModelsManager options are provided, setup the contract
            if (options.functionalityModelsManager) {
                this.functionalityModelsManagerAddress = options.functionalityModelsManager.address;
                this.functionalityModelsManager = new FunctionalityModelsManager(this.web3, this.functionalityModelsManagerAddress, options.functionalityModelsManager.options);
            }
            // If functionalityProposalManager options are provided, setup the contract
            if (options.functionalityProposalManager) {
                this.functionalityProposalManagerAddress = options.functionalityProposalManager.address;
                this.functionalityProposalManager = new FunctionalityProposalManager(this.web3, this.functionalityProposalManagerAddress, options.functionalityProposalManager.options);
            }
            // If proxy options are provided, setup the contract
            if (options.proxy) {
                this.proxyAddress = options.proxy.address;
                this.proxy = new Proxy(this.web3, this.proxyAddress, options.proxy.options);
            }
            // If stateHolder options are provided, setup the contract
            if (options.stateHolder) {
                this.stateHolderAddress = options.stateHolder.address;
                this.stateHolder = new StateHolder(this.web3, this.stateHolderAddress, options.stateHolder.options);
            }
            // If votingToken options are provided, setup the contract
            if (options.votingToken) {
                this.votingTokenAddress = options.votingToken.address;
                this.votingToken = new StateHolder(this.web3, this.votingTokenAddress, options.votingToken.options);
            }
            // If wallet options are provided, setup the contract
            if (options.wallet) {
                this.walletAddress = options.wallet.address;
                this.wallet = new Wallet(this.web3, this.walletAddress, options.wallet.options);
            }
        }
    }
    
    /**
     * Returns the double proxy contract instance at the given address.
     * @param address double proxy contract address.
     * @param options contract options.
     * @return double proxy contract instance.
     */
    getDoubleProxy(address?: string, options?: ContractOptions): DoubleProxy | null {
        if (!address || this.doubleProxyAddress.toLowerCase() === address.toLowerCase()) {
            return this.doubleProxy;
        }
        this.doubleProxy = new DoubleProxy(this.web3, address, options);
        return this.doubleProxy;
    }

    /**
     * Returns the double proxy contract instance at the given address but with a promise.
     * @param address double proxy contract address.
     * @param options contract options.
     * @return double proxy contract instance.
     */
    async getDoubleProxyAsync(address?: string, options?: ContractOptions): Promise<DoubleProxy | any> {
        try {
            const contract = this.getDoubleProxy(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the functionalities manager contract instance at the given address.
     * @param address functionalities manager contract address.
     * @param options contract options.
     * @return functionalities manager contract instance.
     */
    getFunctionalitiesManager(address?: string, options?: ContractOptions): FunctionalitiesManager | null {
        if (!address || this.functionalitiesManagerAddress.toLowerCase() === address.toLowerCase()) {
            return this.functionalitiesManager;
        }
        this.functionalitiesManager = new FunctionalitiesManager(this.web3, address, options);
        return this.functionalitiesManager;
    }

    /**
     * Returns the functionalities manager contract instance at the given address but with a promise.
     * @param address functionalities manager contract address.
     * @param options contract options.
     * @return functionalities manager contract instance.
     */
    async getFunctionalitiesManagerAsync(address?: string, options?: ContractOptions): Promise<FunctionalitiesManager | any> {
        try {
            const contract = this.getFunctionalitiesManager(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the functionality models manager contract instance at the given address.
     * @param address functionality models manager contract address.
     * @param options contract options.
     * @return functionality models manager contract instance.
     */
    getFunctionalityModelsManager(address?: string, options?: ContractOptions): FunctionalityModelsManager | null {
        if (!address || this.functionalityModelsManagerAddress.toLowerCase() === address.toLowerCase()) {
            return this.functionalityModelsManager;
        }
        this.functionalityModelsManager = new FunctionalityModelsManager(this.web3, address, options);
        return this.functionalityModelsManager;
    }

    /**
     * Returns the functionality models manager contract instance at the given address but with a promise.
     * @param address functionality models manager contract address.
     * @param options contract options.
     * @return functionality models manager contract instance.
     */
    async getFunctionalityModelsManagerAsync(address?: string, options?: ContractOptions): Promise<FunctionalityModelsManager | any> {
        try {
            const contract = this.getFunctionalityModelsManager(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the functionality proposal manager instance at the given address.
     * @param address functionality proposal manager address.
     * @param options contract options.
     * @return functionality proposal manager instance.
     */
    getFunctionalityProposalManager(address?: string, options?: ContractOptions): FunctionalityProposalManager | null {
        if (!address || this.functionalityProposalManagerAddress.toLowerCase() === address.toLowerCase()) {
            return this.functionalityProposalManager;
        }
        this.functionalityProposalManager = new FunctionalityProposalManager(this.web3, address, options);
        return this.functionalityProposalManager;
    }

    /**
     * Returns the functionality proposal manager instance at the given address but with a Promise.
     * @param address functionality proposal manager address.
     * @param options contract options.
     * @return functionality proposal manager instance.
     */
    async getFunctionalityProposalManagerAsync(address?: string, options?: ContractOptions): Promise<FunctionalityProposalManager | any> {
        try {
            const contract = this.getFunctionalityProposalManager(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the proxy contract instance at the given address.
     * @param address proxy contract address.
     * @param options contract options.
     * @return proxy contract instance.
     */
    getProxy(address?: string, options?: ContractOptions): Proxy | null {
        if (!address || this.proxyAddress.toLowerCase() === address.toLowerCase()) {
            return this.proxy;
        }
        this.proxy = new Proxy(this.web3, address, options);
        return this.proxy;
    }

    /**
     * Returns the proxy contract instance at the given address but with a Promise.
     * @param address proxy contract address.
     * @param options contract options.
     * @return proxy contract instance.
     */
    async getProxyAsync(address?: string, options?: ContractOptions): Promise<Proxy | any> {
        try {
            const contract = this.getProxy(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the state holder contract instance at the given address.
     * @param address state holder contract address.
     * @param options contract options.
     * @return state holder contract instance.
     */
    getStateHolder(address?: string, options?: ContractOptions): StateHolder | null {
        if (!address || this.stateHolderAddress.toLowerCase() === address.toLowerCase()) {
            return this.stateHolder;
        }
        this.stateHolder = new StateHolder(this.web3, address, options);
        return this.stateHolder;
    }

    /**
     * Returns the state holder contract instance at the given address.
     * @param address state holder contract address.
     * @param options contract options.
     * @return state holder contract instance.
     */
    async getStateHolderAsync(address?: string, options?: ContractOptions): Promise<StateHolder | any> {
        try {
            const contract = this.getStateHolder(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the voting token contract instance at the given address.
     * @param address voting token contract address.
     * @param options contract options.
     * @return voting token contract instance.
     */
    getVotingToken(address?: string, options?: ContractOptions): VotingToken | null {
        if (!address || this.votingTokenAddress.toLowerCase() === address.toLowerCase()) {
            return this.votingToken;
        }
        this.votingToken = new VotingToken(this.web3, address, options);
        return this.votingToken;
    }

    /**
     * Returns the voting token contract instance at the given address.
     * @param address voting token contract address.
     * @param options contract options.
     * @return voting token contract instance.
     */
    async getVotingTokenAsync(address?: string, options?: ContractOptions): Promise<VotingToken | any> {
        try {
            const contract = this.getVotingToken(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns the wallet contract instance at the given address.
     * @param address wallet contract address.
     * @param options contract options.
     * @return wallet contract instance.
     */
    getWallet(address?: string, options?: ContractOptions): Wallet | null {
        if (!address || this.walletAddress.toLowerCase() === address.toLowerCase()) {
            return this.wallet;
        }
        this.wallet = new Wallet(this.web3, address, options);
        return this.wallet;
    }

    /**
     * Returns the wallet contract instance at the given address.
     * @param address wallet contract address.
     * @param options contract options.
     * @return wallet contract instance.
     */
    async getWalletAsync(address?: string, options?: ContractOptions): Promise<Wallet | any> {
        try {
            const contract = this.getWallet(address, options);
            return contract;
        } catch (error) {
            return error;
        }
    }

    /**
     * Returns an EventEmitter to listen for new Proposal Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the Proposal event retrieval.
     */
    getProposalEvents(filter?: any, fromBlock?: number | string): EventEmitter | undefined {
        return this.proxy?.getProposalEvents(filter, fromBlock);
    }

    /**
     * Returns a list of EventData containing all the past Proposal events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastProposalEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[] | undefined> {
        return this.proxy?.getPastProposalEvents(filter, fromBlock, toBlock);
    }
    
    /**
     * Returns an EventEmitter to listen for new ProposalCheck Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the ProposalCheck event retrieval.
     */
    getProposalCheckEvents(filter?: any, fromBlock?: number | string): EventEmitter | undefined {
        return this.proxy?.getProposalCheckEvents(filter, fromBlock);
    }

    /**
     * Returns a list of EventData containing all the past ProposalCheck events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastProposalCheckEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[] | undefined> {
        return this.proxy?.getPastProposalCheckEvents(filter, fromBlock, toBlock);
    }

    /**
     * Returns an EventEmitter to listen for new ProposalSet Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the ProposalSet event retrieval.
     */
    getProposalSetEvents(filter?: any, fromBlock?: number | string): EventEmitter | undefined {
        return this.proxy?.getProposalSetEvents(filter, fromBlock);
    }

    /**
     * Returns a list of EventData containing all the past ProposalSet events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastProposalSetEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[] | undefined> {
        return this.proxy?.getPastProposalSetEvents(filter, fromBlock, toBlock);
    }

    /**
     * Returns an EventEmitter to listen for new FunctionalitySet Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the FunctionalitySet event retrieval.
     */
    getFunctionalitySetEvents(filter?: any, fromBlock?: number | string): EventEmitter | undefined {
        return this.proxy?.getFunctionalitySetEvents(filter, fromBlock);
    }

    /**
     * Returns a list of EventData containing all the past FunctionalitySet events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastFunctionalitySetEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[] | undefined> {
        return this.proxy?.getPastFunctionalitySetEvents(filter, fromBlock, toBlock);
    }

    /**
     * Returns an EventEmitter to listen for new Event Events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return an EventEmitter for the Event event retrieval.
     */
    getEvents(filter?: any, fromBlock?: number | string): EventEmitter | undefined {
        return this.proxy?.getEvents(filter, fromBlock);
    }

    /**
     * Returns a list of EventData containing all the past Event events.
     * @param filter optional event filter.
     * @param fromBlock optional fromBlock parameter (either a number or "latest", "earliest" or "pending"). default is 0.
     * @param toBlock optional toBlock parameter (either a number or "latest", "earliest" or "pending"). default is "latest".
     * @return EventData array.
     */
    async getPastEvents(filter?: any, fromBlock?: number | string, toBlock?: number | string): Promise<EventData[] | undefined> {
        return this.proxy?.getPastEvents(filter, fromBlock, toBlock);
    }
}