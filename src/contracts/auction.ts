import { store } from "@graphprotocol/graph-ts";
import {
  AuctionCancelled as AuctionCancelledEvent,
  AuctionStarted as AuctionStartedEvent,
  BidAccepted as BidAcceptedEvent,
  BidCreated as BidCreatedEvent,
} from "../../generated/Auction/Auction";
import { auctionBid, saleInfo } from "../../generated/schema";
import { fetchAccount, fetchAccountStatistics } from "../utils/erc721";
import { updateAuction } from "./utils";
import { transactions } from "../graphprotcol-utls";

export function handleAuctionCancelled(event: AuctionCancelledEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let entity = saleInfo.load(tokenEntityId);
  if (entity != null) {
    store.remove("saleInfo", entity.id);
  }
}

export function handleAuctionStarted(event: AuctionStartedEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let entity = new saleInfo(tokenEntityId);
  entity.seller = fetchAccount(event.params.seller).id;
  entity.collection = collectionAddress;
  entity.token = tokenEntityId;
  entity.state = "AUCTIONSALE";
  entity.startingBid = event.params.startingBid;
  entity.validity = event.params.endAuctionTime;

  entity.transaction = transactions.log(event).id;

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
  sellerEntity.save();

  let bidderEntity = fetchAccountStatistics(
    fetchAccount(event.params.buyer).id
  );
  bidderEntity.points = bidderEntity.points + 20;
  bidderEntity.save();

  store.remove("saleInfo", tokenEntityId);
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

    let bidEntityId = collectionAddress
      .concat("/")
      .concat(tokenId)
      .concat("/")
      .concat(bidder);
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

    entity.save();
  }
}
