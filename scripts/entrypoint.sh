#!/bin/sh

nohup ganache-cli -p 7545 -h 0.0.0.0 &
truffle test