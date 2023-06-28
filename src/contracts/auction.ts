import {
  AuctionCancelled as AuctionCancelledEvent,
  AuctionStarted as AuctionStartedEvent,
  BidAccepted as BidAcceptedEvent,
  BidCreated as BidCreatedEvent,
} from "../../generated/Auction/Auction";
import { auctionBid, saleInfo } from "../../generated/schema";
import { fetchAccount, fetchAccountStatistics } from "../utils/erc721";
import { updateAuction } from "./utils";
import { clearSaleInfo, updateTxType } from "./marketplace";

export function handleAuctionCancelled(event: AuctionCancelledEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let entity = saleInfo.load(tokenEntityId);
  if (entity != null) {
    clearSaleInfo(entity);
    updateTxType(event, "AUCTION_SALE_CANCELLED", tokenEntityId);
    entity.save();
  }
}

export function handleAuctionStarted(event: AuctionStartedEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let entity = saleInfo.load(tokenEntityId);
  if (entity === null) {
    entity = new saleInfo(tokenEntityId);
  }
  entity.collection = collectionAddress;
  entity.token = tokenEntityId;
  entity.timestamp = event.block.timestamp.toI32();
  entity.state = "AUCTIONSALE";
  entity.startingBid = event.params.startingBid;
  entity.validity = event.params.endAuctionTime;
  updateTxType(event, "AUCTION_SALE_LISTING", tokenEntityId);

  entity.save();
}

export function handleBidAccepted(event: BidAcceptedEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  updateAuction(event);
  let sellerEntity = fetchAccountStatistics(
    fetchAccount(event.params.seller).id
  );
  sellerEntity.points = sellerEntity.points + 10;
  sellerEntity.totalSales = sellerEntity.totalSales + 1;
  sellerEntity.save();

  let bidderEntity = fetchAccountStatistics(
    fetchAccount(event.params.buyer).id
  );
  bidderEntity.points = bidderEntity.points + 20;
  bidderEntity.salesVolume = bidderEntity.salesVolume.plus(event.params.amount);
  bidderEntity.save();
  updateTxType(event, "AUCTION_BID_ACCEPTED", tokenEntityId);
  let entity = saleInfo.load(tokenEntityId);
  if (entity !== null) {
    clearSaleInfo(entity);
    entity.save();
  }
}

export function handleBidCreated(event: BidCreatedEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let entity = saleInfo.load(tokenEntityId);
  if (entity != null) {
    let bidder = fetchAccount(event.params.bidder).id;
    entity.highestBidder = bidder;
    entity.highestBid = event.params.amount;

    let bidEntityId = tokenEntityId.concat("/").concat(bidder);
    let bidEntity = new auctionBid(bidEntityId);
    bidEntity.bidder = bidder;
    bidEntity.bid = event.params.amount;
    bidEntity.save();

    let bids = entity.auctionBids;
    if (bids == null) {
      bids = [];
    }
    bids.push(bidEntityId);
    entity.auctionBids = bids;
    updateTxType(event, "AUCTION_BID_CREATED", tokenEntityId);

    entity.save();
  }
}
