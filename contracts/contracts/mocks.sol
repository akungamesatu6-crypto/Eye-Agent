// SPDX-License-Identifier: MIT
// Test mocks for the marketplace royalty fallback path.
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Plain ERC-721 with NO royalty support — the marketplace must
///  fall back to its hardcoded 5% to the owner wallet.
contract MockERC721NoRoyalty is ERC721 {
    constructor() ERC721("Mock Eye", "MOCK") {}

    function mint(address to, uint256 id) external {
        _mint(to, id);
    }
}
