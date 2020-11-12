const DoubleProxy = artifacts.require("DoubleProxy");
const MVDFunctionalitiesManager = artifacts.require("MVDFunctionalitiesManager");
const MVDFunctionalityModelsManager = artifacts.require("MVDFunctionalityModelsManager");
const MVDFunctionalityProposalManager = artifacts.require("MVDFunctionalityProposalManager");
const MVDProxy = artifacts.require("MVDProxy");
const MVDWallet = artifacts.require("MVDWallet");
const StateHolder = artifacts.require("StateHolder");
const VotingToken = artifacts.require("VotingToken");

const zero = "0x0000000000000000000000000000000000000000";

module.exports = function(deployer) {
  deployer.then(async () => {
    // Deploy MVDFunctionalityModelsManager contract
    await deployer.deploy(MVDFunctionalityModelsManager);
    // Deploy MVDFunctionalitiesManager contract
    await deployer.deploy(MVDFunctionalitiesManager, zero, 0, zero, 0, zero, 0, zero, 0, zero);
    // Deploy MVDFunctionalityProposalManager contract
    await deployer.deploy(MVDFunctionalityProposalManager);
    // Deploy MVDWallet contract
    await deployer.deploy(MVDWallet);
    // Deploy StateHolder contract
    await deployer.deploy(StateHolder);
    // Deploy VotingToken contract
    await deployer.deploy(VotingToken, "VotingToken", "VTK", 16, 1000000);
    // Deploy DoubleProxy contract
    await deployer.deploy(
      DoubleProxy,
      [],
      zero,
      VotingToken.address,
      MVDFunctionalityProposalManager.address,
      StateHolder.address,
      MVDFunctionalityModelsManager.address,
      MVDFunctionalitiesManager.address,
      MVDWallet.address,
    );
    // Deploy MVDProxy contract
    await deployer.deploy(MVDProxy, DoubleProxy.address);
  });
};
