# ETHComputationalOrgs

Repo containing the newly updated **dfo-protocol** contracts.

## Branches structure

- `main` branch contains the production ready **dfo-protocol** contracts;
- `test` branch stages the contracts for testing;
- `development` branch contains the contracts currently in development.

## Directory structure

- `contracts` contains all the **dfo-protocol** contracts;
    - `/interfaces` contains all the interfaces;
    - `/` contains all the non-interface contracts;
- `src` contains the sources for the typescript package files;- `migrations/` contains the `.js` truffle migrations files;
- `scripts/` contains all the useful scripts for testing (eg. `entrypoint.sh` used in the Dockerfile);
- `test/` contains the `.js` truffle tests for the contracts.

## Testing

### Local tests

In order to run the tests locally, simply run in your terminal:

```bash
nohup ganache-cli -p 7545 -h 0.0.0.0 &
truffle test
```

If you don't have the `truffle` and `ganache-cli` commands installed, please use the following command:

```bash
npm install -g ganache-cli
npm install -g truffle
```

You can also use the `entrypoint.sh` script in the `scripts/` folder.

### Docker tests

If you have Docker installed you can run the tests by just simply building the image and running it:

```bash
docker build -t dfo-protocol:test 
docker run -it --rm dfo-protocol:test
```