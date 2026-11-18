const { expect } = require("chai");
const { ethers } = require("hardhat");

const BASE_URI = "https://eye-agent.vercel.app/metadata/";
const PRICE = ethers.parseEther("0.0005");
const LIST_PRICE = ethers.parseEther("0.01");
const ROYALTY_5 = ethers.parseEther("0.0005"); // 5% of 0.01
const SELLER_95 = ethers.parseEther("0.0095");
const BAW = "0x36F3D56eAD5D1D6C2434F94DeFcEF732C5C3CbD2";

describe("EyeAgentMarketplace", function () {
  let token, nft, marketplace;
  let owner, seller, buyer, other;

  beforeEach(async function () {
    [owner, seller, buyer, other] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("EyeToken");
    token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    const Nft = await ethers.getContractFactory("EyeAgentNft");
    nft = await Nft.deploy(BASE_URI, owner.address, await token.getAddress());
    await nft.waitForDeployment();
    await token.connect(owner).setMinter(await nft.getAddress());
    await nft.connect(owner).setMintOpen(true);

    const Market = await ethers.getContractFactory("EyeAgentMarketplace");
    marketplace = await Market.deploy(await nft.getAddress());
    await marketplace.waitForDeployment();

    // seller owns eyes 1, 2, 3 (free + 2 paid)
    await nft.connect(seller)["mint(uint256)"](3, { value: ethers.parseEther("0.001") });
    await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
  });

  it("list happy path: escrow holds the NFT, listing recorded", async function () {
    await expect(marketplace.connect(seller).list(1, LIST_PRICE))
      .to.emit(marketplace, "Listed").withArgs(1, seller.address, LIST_PRICE);
    expect(await nft.ownerOf(1)).to.equal(await marketplace.getAddress());
    const [s, p, active] = await marketplace.getListing(1);
    expect(s).to.equal(seller.address);
    expect(p).to.equal(LIST_PRICE);
    expect(active).to.equal(true);
    expect(await marketplace.getListedIds()).to.deep.equal([1n]);
  });

  it("buy happy path: 0.01 BNB -> 0.0005 royalty to owner, 0.0095 to seller", async function () {
    await marketplace.connect(seller).list(1, LIST_PRICE);
    await expect(marketplace.connect(buyer).buy(1, { value: LIST_PRICE }))
      .to.emit(marketplace, "Sale")
      .withArgs(1, seller.address, buyer.address, LIST_PRICE, ROYALTY_5);
    expect(await nft.ownerOf(1)).to.equal(buyer.address);
    expect(await marketplace.getListedIds()).to.deep.equal([]);
  });

  it("buy balances: buyer -0.01, seller +0.0095, owner (royalty) +0.0005", async function () {
    await marketplace.connect(seller).list(2, LIST_PRICE);
    await expect(marketplace.connect(buyer).buy(2, { value: LIST_PRICE }))
      .to.changeEtherBalances(
        [buyer, seller, owner],
        [LIST_PRICE * -1n, SELLER_95, ROYALTY_5]
      );
  });

  it("buy requires exact payment; seller cannot buy their own listing", async function () {
    await marketplace.connect(seller).list(1, LIST_PRICE);
    await expect(marketplace.connect(buyer).buy(1, { value: LIST_PRICE - 1n }))
      .to.be.revertedWith("exact price required");
    await expect(marketplace.connect(buyer).buy(1, { value: LIST_PRICE + 1n }))
      .to.be.revertedWith("exact price required");
    await expect(marketplace.connect(seller).buy(1, { value: LIST_PRICE }))
      .to.be.revertedWith("seller cannot buy");
    await expect(marketplace.connect(buyer).buy(99, { value: LIST_PRICE }))
      .to.be.revertedWith("not listed");
  });

  it("list guards: price 0, already listed, not the owner", async function () {
    await expect(marketplace.connect(seller).list(1, 0)).to.be.revertedWith("price 0");
    await marketplace.connect(seller).list(1, LIST_PRICE);
    await expect(marketplace.connect(seller).list(1, LIST_PRICE)).to.be.revertedWith("already listed");
    await expect(marketplace.connect(other).list(2, LIST_PRICE)).to.be.revertedWith("not owner");
  });

  it("cancel returns the NFT to the seller; updatePrice changes it", async function () {
    await marketplace.connect(seller).list(1, LIST_PRICE);
    await expect(marketplace.connect(other).cancel(1)).to.be.revertedWith("not seller");
    await expect(marketplace.connect(seller).updatePrice(1, ethers.parseEther("0.02")))
      .to.emit(marketplace, "PriceUpdated").withArgs(1, ethers.parseEther("0.02"));
    await expect(marketplace.connect(seller).cancel(1))
      .to.emit(marketplace, "Cancelled").withArgs(1, seller.address);
    expect(await nft.ownerOf(1)).to.equal(seller.address);
    expect(await marketplace.getListedIds()).to.deep.equal([]);
  });

  it("multiple listings tracked; removing the middle one keeps the rest", async function () {
    await marketplace.connect(seller).list(1, LIST_PRICE);
    await marketplace.connect(seller).list(2, LIST_PRICE);
    await marketplace.connect(seller).list(3, LIST_PRICE);
    expect(await marketplace.getListedIds()).to.deep.equal([1n, 2n, 3n]);
    await marketplace.connect(seller).cancel(2);
    expect(await marketplace.getListedIds()).to.deep.equal([1n, 3n]);
  });

  it("royalty fallback: NFT without ERC-2981 pays 5% to BAW", async function () {
    const Mock = await ethers.getContractFactory("MockERC721NoRoyalty");
    const mockNft = await Mock.deploy();
    await mockNft.waitForDeployment();
    await mockNft.mint(seller.address, 11);

    const Market = await ethers.getContractFactory("EyeAgentMarketplace");
    const mockMarket = await Market.deploy(await mockNft.getAddress());
    await mockMarket.waitForDeployment();
    await mockNft.connect(seller).setApprovalForAll(await mockMarket.getAddress(), true);
    await mockMarket.connect(seller).list(11, LIST_PRICE);

    const bawBefore = await ethers.provider.getBalance(BAW);
    const sellerBefore = await ethers.provider.getBalance(seller.address);
    await expect(mockMarket.connect(buyer).buy(11, { value: LIST_PRICE }))
      .to.emit(mockMarket, "Sale")
      .withArgs(11, seller.address, buyer.address, LIST_PRICE, ROYALTY_5);
    expect(await mockNft.ownerOf(11)).to.equal(buyer.address);
    expect(await ethers.provider.getBalance(BAW)).to.equal(bawBefore + ROYALTY_5);
    expect(await ethers.provider.getBalance(seller.address)).to.equal(sellerBefore + SELLER_95);
  });

  it("constructor rejects the zero NFT address", async function () {
    const Market = await ethers.getContractFactory("EyeAgentMarketplace");
    await expect(Market.deploy(ethers.ZeroAddress)).to.be.revertedWith("zero nft");
  });
});
