import Web3 from 'web3';
import { ContractOptions } from 'web3-eth-contract';
import { 
    DoubleProxy, 
    FunctionalitiesManager, 
    FunctionalityModelsManager, 
    FunctionalityProposalManager, 
    Proxy, 
    StateHolder, 
    VotingToken, 
    Wallet 
} from './contracts';

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
    web3: Web3;
    doubleProxyAddress: string = "";
    readonly doubleProxy: DoubleProxy | null = null;
    functionalitiesManagerAddress: string = "";
    readonly functionalitiesManager: FunctionalitiesManager | null = null;
    functionalityModelsManagerAddress: string = "";
    readonly functionalityModelsManager: FunctionalityModelsManager | null = null;
    functionalityProposalManagerAddress: string = "";
    readonly functionalityProposalManager: FunctionalitiesManager | null = null;
    proxyAddress: string = "";
    readonly proxy: Proxy | null = null;
    stateHolderAddress: string = "";
    readonly stateHolder: StateHolder | null = null;
    votingTokenAddress: string = "";
    readonly votingToken: VotingToken | null = null;
    walletAddress: string = "";
    readonly wallet: Wallet | null = null;

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
                this.wallet = new StateHolder(this.web3, this.walletAddress, options.wallet.options);
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
        return !address ? this.doubleProxy : new DoubleProxy(this.web3, address, options);
    }

    /**
     * Returns the double proxy contract instance at the given address but with a promise.
     * @param address double proxy contract address.
     * @param options contract options.
     * @return double proxy contract instance.
     */
    async getDoubleProxyAsync(address?: string, options?: ContractOptions): Promise<DoubleProxy | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getDoubleProxy(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Returns the functionalities manager contract instance at the given address.
     * @param address functionalities manager contract address.
     * @param options contract options.
     * @return functionalities manager contract instance.
     */
    getFunctionalitiesManager(address?: string, options?: ContractOptions): FunctionalitiesManager | null {
        return !address ? this.functionalitiesManager : new FunctionalitiesManager(this.web3, address, options);
    }

    /**
     * Returns the functionalities manager contract instance at the given address but with a promise.
     * @param address functionalities manager contract address.
     * @param options contract options.
     * @return functionalities manager contract instance.
     */
    async getFunctionalitiesManagerAsync(address?: string, options?: ContractOptions): Promise<FunctionalitiesManager | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getFunctionalitiesManager(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Returns the functionality models manager contract instance at the given address.
     * @param address functionality models manager contract address.
     * @param options contract options.
     * @return functionality models manager contract instance.
     */
    getFunctionalityModelsManager(address?: string, options?: ContractOptions): FunctionalityModelsManager | null {
        return !address ? this.functionalityModelsManager : new FunctionalityModelsManager(this.web3, address, options);
    }

    /**
     * Returns the functionality models manager contract instance at the given address but with a promise.
     * @param address functionality models manager contract address.
     * @param options contract options.
     * @return functionality models manager contract instance.
     */
    async getFunctionalityModelsManagerAsync(address?: string, options?: ContractOptions): Promise<FunctionalityModelsManager | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getFunctionalityModelsManager(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Returns the functionality proposal manager instance at the given address.
     * @param address functionality proposal manager address.
     * @param options contract options.
     * @return functionality proposal manager instance.
     */
    getFunctionalityProposalManager(address?: string, options?: ContractOptions): FunctionalityProposalManager | null {
        return !address ? this.functionalityProposalManager : new FunctionalityProposalManager(this.web3, address, options);
    }

    /**
     * Returns the functionality proposal manager instance at the given address but with a Promise.
     * @param address functionality proposal manager address.
     * @param options contract options.
     * @return functionality proposal manager instance.
     */
    async getFunctionalityProposalManagerAsync(address?: string, options?: ContractOptions): Promise<FunctionalityProposalManager | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getFunctionalityProposalManager(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Returns the proxy contract instance at the given address.
     * @param address proxy contract address.
     * @param options contract options.
     * @return proxy contract instance.
     */
    getProxy(address?: string, options?: ContractOptions): Proxy | null {
        return !address ? this.proxy : new Proxy(this.web3, address, options);
    }

    /**
     * Returns the proxy contract instance at the given address but with a Promise.
     * @param address proxy contract address.
     * @param options contract options.
     * @return proxy contract instance.
     */
    async getProxyAsync(address?: string, options?: ContractOptions): Promise<Proxy | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getProxy(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Returns the state holder contract instance at the given address.
     * @param address state holder contract address.
     * @param options contract options.
     * @return state holder contract instance.
     */
    getStateHolder(address?: string, options?: ContractOptions): StateHolder | null {
        return !address ? this.stateHolder : new StateHolder(this.web3, address, options);
    }

    /**
     * Returns the state holder contract instance at the given address.
     * @param address state holder contract address.
     * @param options contract options.
     * @return state holder contract instance.
     */
    async getStateHolderAsync(address?: string, options?: ContractOptions): Promise<StateHolder | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getStateHolder(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Returns the voting token contract instance at the given address.
     * @param address voting token contract address.
     * @param options contract options.
     * @return voting token contract instance.
     */
    getVotingToken(address?: string, options?: ContractOptions): VotingToken | null {
        return !address ? this.votingToken : new VotingToken(this.web3, address, options);
    }

    /**
     * Returns the voting token contract instance at the given address.
     * @param address voting token contract address.
     * @param options contract options.
     * @return voting token contract instance.
     */
    async getVotingTokenAsync(address?: string, options?: ContractOptions): Promise<VotingToken | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getVotingToken(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * Returns the wallet contract instance at the given address.
     * @param address wallet contract address.
     * @param options contract options.
     * @return wallet contract instance.
     */
    getWallet(address?: string, options?: ContractOptions): Wallet | null {
        return !address ? this.wallet : new Wallet(this.web3, address, options);
    }

    /**
     * Returns the wallet contract instance at the given address.
     * @param address wallet contract address.
     * @param options contract options.
     * @return wallet contract instance.
     */
    async getWalletAsync(address?: string, options?: ContractOptions): Promise<Wallet | any> {
        return new Promise((resolve, reject) => {
            try {
                const contract = this.getWallet(address, options);
                resolve(contract);
            } catch (error) {
                reject(error);
            }
        })
    }
}