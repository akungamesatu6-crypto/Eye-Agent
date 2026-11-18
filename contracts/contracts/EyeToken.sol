// SPDX-License-Identifier: MIT
// EYE — BEP-20 bonus token for Eye Agent paid mints.
// Mirrors HATCH (HATCHIEggy) exactly, renamed:
//   Total supply 1,000,000,000 EYE (18 decimals), fixed at deploy —
//   NO further minting ever. Bonus pool 540,000,000 EYE is held by this
//   token contract itself; the remaining 460,000,000 EYE is minted to the
//   owner at deploy (treasury — owner-controlled, not part of the bonus
//   pool). Every paid Eye Agent mint accrues 120,000 EYE for the minter's
//   wallet, recorded by the NFT contract via accrue() (only the NFT
//   contract — set by the owner with setMinter() after the NFT deploys —
//   can accrue). Free mints accrue 0. Max 1,080,000 EYE per wallet
//   (9 paid mints x 120,000); accrue() enforces both the per-wallet cap
//   and the pool cap (total accrued can never exceed 540,000,000).
//   Worst case the whole 1,001 collection could pay out
//   1,001 x 120,000 = 120,120,000 EYE < 540,000,000 pool.
//   Claims are retroactive: claim() pays the caller's claimable balance;
//   claimFor(address) pays a beneficiary's claimable balance and can be
//   called by any wallet. No staking, no tax, no pausing, no blacklist —
//   plain ERC-20 + accrual ledger.
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title EYE
contract EyeToken is ERC20, Ownable {
    uint256 public constant BONUS_POOL = 540_000_000 ether; // held by this contract
    uint256 public constant BONUS_PER_PAID_MINT = 120_000 ether;
    uint256 public constant MAX_BONUS_PER_WALLET = 1_080_000 ether; // 9 paid x 120,000

    address public minter; // the Eye Agent NFT contract; set by owner after NFT deploy
    uint256 public totalAccrued; // sum of all accrue() amounts; never exceeds BONUS_POOL

    mapping(address => uint256) public accrued; // lifetime bonus earned
    mapping(address => uint256) public claimed; // lifetime bonus claimed

    event Accrued(address indexed wallet, uint256 amount, uint256 totalAccruedForWallet);
    event Claimed(address indexed wallet, uint256 amount);
    event MinterSet(address indexed minter);

    error NotMinter();
    error NothingToClaim();
    error OverPoolCap();
    error OverWalletCap();

    constructor(address owner_) ERC20("EYE", "EYE") Ownable(owner_) {
        // Pool stays in this contract for claims; remainder goes to the owner.
        _mint(address(this), BONUS_POOL);
        _mint(owner_, 460_000_000 ether);
    }

    /// @notice Claimable EYE for a wallet (accrued minus already claimed).
    function claimable(address wallet) public view returns (uint256) {
        return accrued[wallet] - claimed[wallet];
    }

    /// @notice Record a bonus for a wallet. Only the NFT contract can call this.
    function accrue(address wallet, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        if (totalAccrued + amount > BONUS_POOL) revert OverPoolCap();
        if (accrued[wallet] + amount > MAX_BONUS_PER_WALLET) revert OverWalletCap();
        accrued[wallet] += amount;
        totalAccrued += amount;
        emit Accrued(wallet, amount, accrued[wallet]);
    }

    /// @notice Claim your own waiting EYE.
    function claim() external {
        _claim(msg.sender);
    }

    /// @notice Claim a beneficiary's waiting EYE to that beneficiary. Callable by anyone.
    function claimFor(address beneficiary) external {
        _claim(beneficiary);
    }

    function _claim(address wallet) internal {
        uint256 amount = claimable(wallet);
        if (amount == 0) revert NothingToClaim();
        claimed[wallet] += amount;
        _transfer(address(this), wallet, amount);
        emit Claimed(wallet, amount);
    }

    /// @notice Point accrual at the Eye Agent NFT contract (called once, by owner, after NFT deploy).
    function setMinter(address minter_) external onlyOwner {
        minter = minter_;
        emit MinterSet(minter_);
    }
}
