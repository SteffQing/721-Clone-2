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
  TradeFeeUpdated as TradeFeeUpdatedEvent,
  ProtocolRemoved as ProtocolRemovedEvent
} from "../../generated/Marketplace/Marketplace";
import {
  supportedCollection,
  saleInfo,
  protocol,
  collection,
} from "../../generated/schema";
import { CollectionMetadata as CollectionDataTemplate } from "../../generated/templates";
import { store, BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import {
  fetchAccount,
  fetchAccountStatistics,
  fetchRegistry,
  fetchToken,
} from "../utils/erc721";
import { updateSalesData } from "./utils";
import { constants, transactions } from "../graphprotcol-utls";

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
    updateTxType(event, "FIXED_SALE_CANCELLED")
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
  entity.transaction = updateTxType(event, "FIXED_SALE_LISTING")
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
  buyerEntity.salesVolume = buyerEntity.salesVolume.plus(event.params.price);
  buyerEntity.points = buyerEntity.points + 20;
  buyerEntity.save();
  updateTxType(event, "FIXED_SALE_SOLD")

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
    entity.transaction = updateTxType(event, "FIXED_SALE_UPDATED");

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
  entity.totalLoanCount = 0;
  entity.totalLoanVolume = constants.BIGDECIMAL_ZERO;
  entity.largestLoan = constants.BIGDECIMAL_ZERO
  entity.averageLoanAmount = constants.BIGDECIMAL_ZERO
  entity.totalPaidInterest = constants.BIGINT_ZERO;
  entity.save();
}

export function handleProtocolRemoval(event: ProtocolRemovedEvent):void{
  let entity = protocol.load(event.params.protocol)
  if(entity != null){
    store.remove("protocol", entity.id.toHexString())
  }
}

export function handleFeeUpdate(event: TradeFeeUpdatedEvent): void {
  let marketplace = constants.Marketplace.toLowerCase()
  updateProtocolFeeParameters(
    Address.fromString(marketplace),
    0,
    event.params.fees.toI32()
  );
}

export function updateProtocolLoanData(
  _protocol: Address,
  amount: BigInt,
  interest: BigInt
): void {
  let entity = protocol.load(_protocol);
  if (entity) {
    let loanCount = entity.totalLoanCount
    let loanAmount = amount.toBigDecimal()
    entity.totalLoanCount = loanCount + 1;
    entity.totalLoanVolume = entity.totalLoanVolume.plus(loanAmount);
    if(loanAmount.gt(entity.largestLoan)){
      entity.largestLoan = loanAmount;
    }
    entity.averageLoanAmount = entity.totalLoanVolume.div(BigInt.fromI32(loanCount).toBigDecimal())
    entity.totalPaidInterest = entity.totalPaidInterest.plus(interest);
    entity.save();
  }
}

export function updateProtocolFeeParameters(
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

export function updateTxType(event: ethereum.Event, txType: string):string{
  let tx = transactions.log(event)
  tx.txType = txType
  tx.save()
  return tx.id
}