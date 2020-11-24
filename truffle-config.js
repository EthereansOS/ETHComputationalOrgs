module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 7545,
      network_id: "*", // Match any network id
      gas: 6721975
    }
  },
  compilers: {
    solc: {
      version: "0.6.0",
      parser: "solcjs"
    }
  }
};
