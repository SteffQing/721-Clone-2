import {
  CollectionAdded as CollectionAddedEvent,
  CollectionRemoved as CollectionRemovedEvent,
  CollectionUpdated as CollectionUpdatedEvent,
  CollectionVerificationStatus as CollectionVerificationStatusEvent,
  ItemDelisted as ItemDelistedEvent,
  ItemListed as ItemListedEvent,
  ItemSold as ItemSoldEvent,
  ItemUpdated as ItemUpdatedEvent,
  RevenueWithdrawn as RevenueWithdrawnEvent,
  ProtocolCreated as ProtocolCreatedEvent,
} from "../../generated/Marketplace/Marketplace";
import {
  supportedCollection,
  saleInfo,
  protocol,
  collection,
} from "../../generated/schema";
import { CollectionMetadata as CollectionDataTemplate } from "../../generated/templates";
import { store, BigInt, Address } from "@graphprotocol/graph-ts";
import {
  fetchAccount,
  fetchAccountStatistics,
  fetchRegistry,
  fetchToken,
} from "../utils/erc721";
import { updateSalesData } from "./utils";
import { transactions } from "../graphprotcol-utls";

export function handleCollectionAdded(event: CollectionAddedEvent): void {
  let collectionEntity = collection.load(event.params.collection.toHex());
  if (collectionEntity == null) {
    collectionEntity = fetchRegistry(event.params.collection);
  }
  let entity = new supportedCollection(collectionEntity.id);
  entity.creator = event.params.collectionFeeCollector;
  entity.royaltyFees = event.params.royaltyFees;
  entity.collection = collectionEntity.id;

  entity.save();
}

export function handleCollectionRemoval(event: CollectionRemovedEvent): void {
  let entity = supportedCollection.load(event.params.collection.toHex());
  if (entity != null) {
    store.remove("supportedCollection", entity.id);
  }
}

export function handleCollectionUpdate(event: CollectionUpdatedEvent): void {
  let entity = supportedCollection.load(event.params.collection.toHex());
  if (entity != null) {
    entity.creator = event.params.collectionFeeCollector;
    entity.royaltyFees = event.params.royaltyFees;

    entity.save();
  }
}

export function handleCollectionVerification(
  event: CollectionVerificationStatusEvent
): void {
  let entity = supportedCollection.load(event.params.collection.toHex());
  if (entity != null) {
    // Add ipfs hash
    entity.metadata = event.params.ipfs;
    // create template to fetch the data
    CollectionDataTemplate.create(event.params.ipfs);
    entity.save();
  }
}

export function handleItemDelisted(event: ItemDelistedEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId;
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId.toString());
  let entity = saleInfo.load(tokenEntityId);
  if (entity != null) {
    store.remove("saleInfo", entity.id);
  }
}

export function handleItemListed(event: ItemListedEvent): void {
  let collectionEntity = fetchRegistry(event.params.collection);
  let tokenId = event.params.tokenId;
  let tokenEntityId = "kcc/"
    .concat(collectionEntity.id)
    .concat("/")
    .concat(tokenId.toString());
  let timestampBigInt = BigInt.fromI32(event.block.timestamp.toI32());
  let Token = fetchToken(collectionEntity, tokenId, timestampBigInt);
  let entity = new saleInfo(tokenEntityId);
  entity.token = Token.id;
  entity.collection = collectionEntity.id;
  entity.seller = fetchAccount(event.params.seller).id;
  entity.salePrice = event.params.price;
  entity.transaction = transactions.log(event).id;
  entity.state = "FIXEDSALE";
  entity.save();
}

export function handleItemSold(event: ItemSoldEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId;
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId.toString());
  let entity = saleInfo.load(tokenEntityId);
  updateSalesData(event);
  let sellerEntity = fetchAccountStatistics(
    fetchAccount(event.params.seller).id
  );
  sellerEntity.points = sellerEntity.points + 10;
  sellerEntity.totalSales = sellerEntity.totalSales + 1;
  sellerEntity.save();
  let buyerEntity = fetchAccountStatistics(fetchAccount(event.params.buyer).id);
  buyerEntity.totalVolume = buyerEntity.totalVolume.plus(event.params.price);
  buyerEntity.points = buyerEntity.points + 20;
  buyerEntity.save();

  if (entity != null) {
    store.remove("saleInfo", entity.id);
  }
}

export function handleItemUpdated(event: ItemUpdatedEvent): void {
  let _collection = fetchRegistry(event.params.collection);
  let tokenId = event.params.tokenId;
  let tokenEntity = fetchToken(
    _collection,
    tokenId,
    BigInt.fromI32(event.block.timestamp.toI32())
  );
  let entity = saleInfo.load(tokenEntity.id);
  if (entity != null) {
    entity.salePrice = event.params.newPrice;
    entity.transaction = transactions.log(event).id;

    entity.save();
  }
}

export function handleRevenueWithdrawn(event: RevenueWithdrawnEvent): void {
  let entity = fetchAccountStatistics(fetchAccount(event.params.account).id);
  entity.revenue = entity.revenue.plus(event.params.amount);
  entity.save();
}


export function handleProtocolCreation(event: ProtocolCreatedEvent): void {
  let _protocol = event.params.protocol;
  let entity = new protocol(_protocol);
  entity.name = event.params.name;
  entity.protocolFee = event.params.protocolFee;
  entity.securityFee = event.params.securityFee;
  entity.totalBorrows = constants.BIGINT_ZERO;
  entity.totalPaidInterest = constants.BIGINT_ZERO;
  entity.save();
}

export function updateProtocol(
  _protocol: Address,
  borrow: BigInt,
  interest: BigInt
): void {
  let entity = protocol.load(_protocol);
  if (entity) {
    entity.totalBorrows = entity.totalBorrows.plus(borrow);
    entity.totalPaidInterest = entity.totalPaidInterest.plus(interest);
    entity.save();
  }
}

export function updateProtocolParameters(
  _protocol: Address,
  securityFee: number,
  protocolFee: number
): void {
  let entity = protocol.load(_protocol);
  if (entity) {
    entity.securityFee = securityFee as i32;
    entity.protocolFee = protocolFee as i32;
    entity.save();
  }
}
