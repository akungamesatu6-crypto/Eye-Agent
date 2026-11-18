const { expect } = require("chai");
const { ethers } = require("hardhat");

const BASE_URI = "https://eye-agent.vercel.app/metadata/";
const PRICE = ethers.parseEther("0.0005");
const BONUS = ethers.parseEther("120000");
const MAX_BONUS = ethers.parseEther("1080000");
const POOL = ethers.parseEther("540000000");
const TREASURY = ethers.parseEther("460000000");
const TOTAL = ethers.parseEther("1000000000");

// ethers v6: the NFT has two `mint` overloads, so calls must use the
// fully-qualified form: nft["mint()"]() and nft["mint(uint256)"](qty).
const mintOne = (nft, signer, overrides) => nft.connect(signer)["mint()"]((overrides || {}));
const mintQty = (nft, signer, qty, overrides) => nft.connect(signer)["mint(uint256)"](qty, (overrides || {}));

describe("Eye Agent (NFT + EYE token)", function () {
  let token, nft, caller;
  let owner, alice, bob, carol, dave;

  beforeEach(async function () {
    [owner, alice, bob, carol, dave] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("EyeToken");
    token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    const Nft = await ethers.getContractFactory("EyeAgentNft");
    nft = await Nft.deploy(BASE_URI, owner.address, await token.getAddress());
    await nft.waitForDeployment();

    // Owner points the token's minter at the NFT (the real deploy step).
    await token.connect(owner).setMinter(await nft.getAddress());

    const Caller = await ethers.getContractFactory("MintCaller");
    caller = await Caller.deploy(await nft.getAddress());
    await caller.waitForDeployment();
  });

  async function openMint() {
    await nft.connect(owner).setMintOpen(true);
  }

  it("constants match the BRIEF: supply 1001, price 0.0005, max 10/wallet, bonus 120,000", async function () {
    expect(await nft.MAX_SUPPLY()).to.equal(1001);
    expect(await nft.PRICE()).to.equal(PRICE);
    expect(await nft.MAX_PER_WALLET()).to.equal(10);
    expect(await nft.BONUS_PER_PAID_MINT()).to.equal(BONUS);
    expect(await nft.MAX_BONUS_PER_WALLET()).to.equal(MAX_BONUS);
    expect(await nft.name()).to.equal("Eye Agent");
    expect(await nft.symbol()).to.equal("EYE");
    expect(await nft.owner()).to.equal(owner.address);
    expect(await token.name()).to.equal("EYE");
    expect(await token.symbol()).to.equal("EYE");
    expect(await token.BONUS_POOL()).to.equal(POOL);
    expect(await token.totalSupply()).to.equal(TOTAL);
  });

  it("token split: 540M pool held by the token contract, 460M treasury to owner", async function () {
    expect(await token.balanceOf(await token.getAddress())).to.equal(POOL);
    expect(await token.balanceOf(owner.address)).to.equal(TREASURY);
  });

  it("royalty: 5% to the owner (ERC-2981)", async function () {
    const [receiver, amount] = await nft.royaltyInfo(1, ethers.parseEther("1"));
    expect(receiver).to.equal(owner.address);
    expect(amount).to.equal(ethers.parseEther("0.05"));
  });

  it("mint starts CLOSED; only the owner can open it", async function () {
    expect(await nft.mintOpen()).to.equal(false);
    await expect(mintOne(nft, alice)).to.be.revertedWithCustomError(nft, "MintClosed");
    await expect(nft.connect(alice).setMintOpen(true)).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    await openMint();
    expect(await nft.mintOpen()).to.equal(true);
  });

  it("free first mint: id 1, 0 value, no EYE accrued, freeMinted 1", async function () {
    await openMint();
    await expect(mintOne(nft, alice))
      .to.emit(nft, "Minted").withArgs(alice.address, 1, false, 0);
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.freeClaimed(alice.address)).to.equal(true);
    expect(await nft.mintedOf(alice.address)).to.equal(1);
    expect(await nft.totalMinted()).to.equal(1);
    expect(await nft.freeMinted()).to.equal(1);
    expect(await nft.paidMinted()).to.equal(0);
    expect(await token.accrued(alice.address)).to.equal(0);
    expect(await nft.tokenURI(1)).to.equal(BASE_URI + "1");
  });

  it("second mint costs exactly 0.0005 BNB and accrues 120,000 EYE", async function () {
    await openMint();
    await mintOne(nft, alice); // free
    await expect(mintOne(nft, alice, { value: PRICE }))
      .to.emit(nft, "Minted").withArgs(alice.address, 2, true, BONUS);
    expect(await nft.ownerOf(2)).to.equal(alice.address);
    expect(await nft.totalMinted()).to.equal(2);
    expect(await nft.paidMinted()).to.equal(1);
    expect(await token.accrued(alice.address)).to.equal(BONUS);
    expect(await token.totalAccrued()).to.equal(BONUS);
    expect(await token.claimable(alice.address)).to.equal(BONUS);
  });

  it("underpay AND overpay both revert WrongValue(required)", async function () {
    await openMint();
    await mintOne(nft, alice); // free used
    await expect(mintOne(nft, alice, { value: PRICE - 1n }))
      .to.be.revertedWithCustomError(nft, "WrongValue").withArgs(PRICE);
    await expect(mintOne(nft, alice, { value: PRICE + 1n }))
      .to.be.revertedWithCustomError(nft, "WrongValue").withArgs(PRICE);
    await expect(mintOne(nft, alice, { value: 0 }))
      .to.be.revertedWithCustomError(nft, "WrongValue").withArgs(PRICE);
  });

  it("priceFor: fresh wallet qty 1 = 0, qty 3 = 0.001, qty 10 = 0.0045; after free, qty 3 = 0.0015", async function () {
    expect(await nft.priceFor(bob.address, 0)).to.equal(0);
    expect(await nft.priceFor(bob.address, 1)).to.equal(0);
    expect(await nft.priceFor(bob.address, 3)).to.equal(ethers.parseEther("0.001"));
    expect(await nft.priceFor(bob.address, 10)).to.equal(ethers.parseEther("0.0045"));
    expect(await nft.nextPrice(bob.address)).to.equal(0);
    await openMint();
    await mintOne(nft, bob); // free used
    expect(await nft.nextPrice(bob.address)).to.equal(PRICE);
    expect(await nft.priceFor(bob.address, 3)).to.equal(ethers.parseEther("0.0015"));
  });

  it("batch mint: fresh wallet mint(5) for 0.002 BNB — ids 1..5 sequential, 4 paid, 480,000 EYE", async function () {
    await openMint();
    await expect(mintQty(nft, carol, 5, { value: ethers.parseEther("0.002") }))
      .to.emit(nft, "Minted");
    for (let id = 1; id <= 5; id++) {
      expect(await nft.ownerOf(id)).to.equal(carol.address);
      expect(await nft.tokenURI(id)).to.equal(BASE_URI + String(id));
    }
    expect(await nft.totalMinted()).to.equal(5);
    expect(await nft.freeMinted()).to.equal(1);
    expect(await nft.paidMinted()).to.equal(4);
    expect(await token.accrued(carol.address)).to.equal(ethers.parseEther("480000"));
  });

  it("over-limit: mint(11) reverts; 10 max, then the 11th reverts", async function () {
    await openMint();
    await expect(mintQty(nft, dave, 11, { value: ethers.parseEther("0.005") }))
      .to.be.revertedWithCustomError(nft, "OverLimit");
    await mintQty(nft, dave, 10, { value: ethers.parseEther("0.0045") });
    expect(await nft.mintedOf(dave.address)).to.equal(10);
    expect(await token.accrued(dave.address)).to.equal(MAX_BONUS); // 9 paid x 120,000
    await expect(mintOne(nft, dave, { value: PRICE }))
      .to.be.revertedWithCustomError(nft, "OverLimit");
    await expect(mintQty(nft, dave, 0))
      .to.be.revertedWithCustomError(nft, "OverLimit");
  });

  it("EOA-only gate: a contract caller reverts NotAgent on mint() and mint(qty)", async function () {
    await openMint();
    await expect(caller.callMint()).to.be.revertedWithCustomError(nft, "NotAgent");
    await expect(caller.callMintQty(1, { value: 0 })).to.be.revertedWithCustomError(nft, "NotAgent");
  });

  it("claim: 120,000 EYE paid out once, then NothingToClaim; claimFor works for others", async function () {
    await openMint();
    await mintOne(nft, alice);
    await mintOne(nft, alice, { value: PRICE });
    expect(await token.claimable(alice.address)).to.equal(BONUS);
    await expect(token.connect(alice).claim())
      .to.changeTokenBalances(token, [alice, token], [BONUS, BONUS * -1n]);
    expect(await token.claimable(alice.address)).to.equal(0);
    await expect(token.connect(alice).claim()).to.be.revertedWithCustomError(token, "NothingToClaim");
    // claimFor: bob claims for carol
    await mintOne(nft, carol);
    await mintOne(nft, carol, { value: PRICE });
    await expect(token.connect(bob).claimFor(carol.address))
      .to.changeTokenBalances(token, [carol, token], [BONUS, BONUS * -1n]);
  });

  it("accrue is minter-only; setMinter is owner-only", async function () {
    await expect(token.connect(alice).accrue(alice.address, BONUS))
      .to.be.revertedWithCustomError(token, "NotMinter");
    await expect(token.connect(alice).setMinter(alice.address))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("owner can update baseURI; withdraw sends the contract balance to the owner", async function () {
    await openMint();
    await mintOne(nft, alice);
    await mintOne(nft, alice, { value: PRICE });
    expect(await ethers.provider.getBalance(await nft.getAddress())).to.equal(PRICE);
    await expect(nft.connect(owner).withdraw())
      .to.changeEtherBalance(owner, PRICE);
    expect(await ethers.provider.getBalance(await nft.getAddress())).to.equal(0);
    await nft.connect(owner).setBaseURI("https://example.com/meta/");
    expect(await nft.tokenURI(1)).to.equal("https://example.com/meta/1");
    await expect(nft.connect(alice).setBaseURI("https://evil.example/"))
      .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
  });

  it("sequential ids: nextId advances 1..N and tokenURI matches the baseURI + id", async function () {
    await openMint();
    await mintQty(nft, alice, 3, { value: ethers.parseEther("0.001") });
    expect(await nft.nextId()).to.equal(4);
    expect(await nft.exists(3)).to.equal(true);
    expect(await nft.exists(4)).to.equal(false);
    await expect(nft.tokenURI(99)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
  });
});
