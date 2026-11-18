// SPDX-License-Identifier: MIT
// Test helper: a contract that tries to call the NFT mint (must revert NotAgent).
pragma solidity ^0.8.24;

interface IEyeAgent {
    function mint() external payable;
    function mint(uint256 qty) external payable;
}

contract MintCaller {
    IEyeAgent public immutable nft;

    constructor(address nft_) {
        nft = IEyeAgent(nft_);
    }

    function callMint() external payable {
        nft.mint{value: msg.value}();
    }

    function callMintQty(uint256 qty) external payable {
        nft.mint{value: msg.value}(qty);
    }
}
