// SPDX-License-Identifier: MIT
// Eye Agent — agent-only eye collection on BNB Chain.
// Mirrors HATCHIEggy (HatchieGgyFactory.sol) exactly, with these spec deltas:
//   Supply 1,001 (not 4,444). PRICE 0.0005 BNB flat after the free first
//   mint (not 0.001). Max 10 per wallet cumulative. Sequential ids 1-1001.
//   First mint per wallet is FREE (0 BNB + gas); every mint after that
//   costs a FIXED 0.0005 BNB. mint() mints 1; mint(uint256 qty) mints a
//   batch — for a wallet that has not used its free mint, the first token
//   in the batch is free and the rest are paid (priceFor(wallet, qty)).
//   Exact payment only: msg.value must equal priceFor exactly — overpay
//   AND underpay both revert.
//   Gate (HATCHIEggy model, exactly): ANY agent wallet that can send a
//   BNB Chain tx can mint — Binance Agentic Wallet or any other agent
//   wallet. There is NO Agent ID registry check on-chain. Enforced as
//   msg.sender == tx.origin, so contracts cannot mint.
//   Bonus token: every PAID mint accrues 120,000 EYE on the EYE token
//   contract (IEyeToken.accrue); free mints accrue 0. Max 1,080,000
//   EYE per wallet (9 paid mints x 120,000). Claimable on-chain via
//   claim() / claimFor(address), retroactive — mint first, claim whenever.
//   BEP-721 (ERC721 + ERC-2981 5% royalty), BNB Chain Mainnet (56).
//   Owner can ONLY: open/close mint, update baseURI, withdraw.
//   Prices, supply and limits are immutable after deploy.
//   baseURI: https://eye-agent.vercel.app/metadata/
//   DELIBERATE DEVIATION from HATCHIEggy: mintOpen starts FALSE here
//   (HATCHIEggy opened immediately at deploy). Eye Agent deploy and
//   mint-open are separate confirmed steps — the owner calls
//   setMintOpen(true) only after the page and metadata are verified.
//   freeMinted counts free claims (page live-status reads it).
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IEyeToken {
    function accrue(address wallet, uint256 amount) external;
}

/// @title Eye Agent
contract EyeAgentNft is ERC721, ERC2981, Ownable, ReentrancyGuard {
    IEyeToken public immutable EYE;

    uint256 public constant MAX_SUPPLY = 1001;
    uint256 public constant PRICE = 0.0005 ether; // fixed, after the free first mint
    uint256 public constant MAX_PER_WALLET = 10;
    uint256 public constant BONUS_PER_PAID_MINT = 120_000 ether; // 120,000 EYE (18 decimals)
    uint256 public constant MAX_BONUS_PER_WALLET = 1_080_000 ether; // 9 paid x 120,000

    uint256 public totalMinted;
    uint256 public freeMinted; // free claims so far (page live-status)
    uint256 public nextId = 1; // sequential ids 1..1001
    bool public mintOpen;
    string private _base;

    mapping(address => bool) public freeClaimed;
    mapping(address => uint256) public mintedOf;

    event Minted(address indexed agent, uint256 indexed id, bool paid, uint256 bonusAccrued);

    error NotAgent();
    error MintClosed();
    error SoldOut();
    error OverLimit();
    error WrongValue(uint256 required);

    constructor(string memory baseURI_, address owner_, address eyeToken_)
        ERC721("Eye Agent", "EYE")
        Ownable(owner_)
    {
        _base = baseURI_;
        EYE = IEyeToken(eyeToken_);
        mintOpen = false; // mint starts CLOSED until owner opens it
        _setDefaultRoyalty(owner_, 500); // 5%
    }

    modifier onlyAgent() {
        // A real wallet signing directly (no contracts in between).
        // No Agent ID registry check — any agent wallet can mint.
        if (msg.sender != tx.origin) revert NotAgent();
        if (!mintOpen) revert MintClosed();
        _;
    }

    /// @notice Price of the NEXT single mint for a wallet (0 if free claim unused, else PRICE).
    function nextPrice(address wallet) public view returns (uint256) {
        return freeClaimed[wallet] ? PRICE : 0;
    }

    /// @notice Exact BNB cost of minting `qty` eyes for a wallet.
    /// @dev First token in the batch is free if the wallet has not claimed it yet.
    function priceFor(address wallet, uint256 qty) public view returns (uint256) {
        if (qty == 0) return 0;
        uint256 paidQty = freeClaimed[wallet] ? qty : qty - 1;
        return PRICE * paidQty;
    }

    /// @notice Fixed price of one paid eye in wei. No oracle: PRICE is immutable.
    function priceWei() public pure returns (uint256) {
        return PRICE;
    }

    function currentPrice() public pure returns (uint256) {
        return PRICE;
    }

    function totalSupply() external view returns (uint256) {
        return totalMinted;
    }

    /// @notice Paid mints so far (total minus free claims).
    function paidMinted() external view returns (uint256) {
        return totalMinted - freeMinted;
    }

    function exists(uint256 id) external view returns (bool) {
        return _ownerOf(id) != address(0);
    }

    /// @notice Mint one eye. First mint per wallet is free (value 0); after that 0.0005 BNB.
    function mint() external payable nonReentrant onlyAgent {
        _mintBatch(1);
    }

    /// @notice Mint `qty` eyes. Value must equal priceFor(msg.sender, qty) exactly.
    function mint(uint256 qty) external payable nonReentrant onlyAgent {
        _mintBatch(qty);
    }

    function _mintBatch(uint256 qty) internal {
        if (qty == 0 || mintedOf[msg.sender] + qty > MAX_PER_WALLET) revert OverLimit();
        if (totalMinted + qty > MAX_SUPPLY) revert SoldOut();
        uint256 cost = priceFor(msg.sender, qty);
        if (msg.value != cost) revert WrongValue(cost);
        uint256 paidQty = freeClaimed[msg.sender] ? qty : qty - 1;
        if (!freeClaimed[msg.sender]) {
            freeClaimed[msg.sender] = true;
            freeMinted += 1;
        }
        mintedOf[msg.sender] += qty;
        totalMinted += qty;
        for (uint256 i; i < qty; i++) {
            uint256 id = nextId++;
            bool paid = i >= qty - paidQty;
            _safeMint(msg.sender, id);
            emit Minted(msg.sender, id, paid, paid ? BONUS_PER_PAID_MINT : 0);
        }
        // Accrue the EYE bonus for the paid mints in this batch (0 for free-only mints).
        if (paidQty > 0) {
            EYE.accrue(msg.sender, BONUS_PER_PAID_MINT * paidQty);
        }
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return string.concat(_base, Strings.toString(id));
    }

    // ── owner: only these three switches exist ──
    function setMintOpen(bool v) external onlyOwner {
        mintOpen = v;
    }

    function setBaseURI(string calldata b) external onlyOwner {
        _base = b;
    }

    function withdraw() external onlyOwner nonReentrant {
        (bool ok, ) = owner().call{value: address(this).balance}("");
        require(ok, "withdraw");
    }

    function supportsInterface(bytes4 i) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(i);
    }
}
