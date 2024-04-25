import {
  CollectionAdded as CollectionAddedEvent,
  CollectionRemoved as CollectionRemovedEvent,
  CollectionUpdated as CollectionUpdatedEvent,
  CollectionVerificationStatus as CollectionVerificationStatusEvent,
  RevenueWithdrawn as RevenueWithdrawnEvent,
  ProtocolCreated as ProtocolCreatedEvent,
  protocolFeeUpdated as TradeFeeUpdatedEvent,
  ProtocolRemoved as ProtocolRemovedEvent,
} from "../../generated/Protocol/Protocol";
import {
  supportedCollection,
  protocol,
  collection,
} from "../../generated/schema";
import { CollectionMetadata as CollectionDataTemplate } from "../../generated/templates";
import { store, BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import {
  fetchAccount,
  fetchAccountStatistics,
  fetchRegistry,
} from "../utils/erc721";
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
  entity.status = "UNVERIFIED";

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
    entity.status = "UNVERIFIED";

    entity.save();
  }
}

export function handleCollectionVerification(
  event: CollectionVerificationStatusEvent
): void {
  let entity = supportedCollection.load(event.params.collection.toHex());
  if (entity != null) {
    // Add ipfs hash
    let ipfsHash = event.params.ipfs;
    entity.metadata = ipfsHash;
    entity.status = "VERIFIED";
    // create template to fetch the data
    CollectionDataTemplate.create(ipfsHash);
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
  entity.largestLoan = constants.BIGDECIMAL_ZERO;
  entity.averageLoanAmount = constants.BIGDECIMAL_ZERO;
  entity.totalPaidInterest = constants.BIGINT_ZERO;
  entity.save();
}

export function handleProtocolRemoval(event: ProtocolRemovedEvent): void {
  let entity = protocol.load(event.params.protocol);
  if (entity != null) {
    store.remove("protocol", entity.id.toHexString());
  }
}

export function handleFeeUpdate(event: TradeFeeUpdatedEvent): void {
  let protocol = constants.Protocol.toLowerCase();
  updateProtocolFeeParameters(
    Address.fromString(protocol),
    constants.BIGINT_ZERO.toI32(),
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
    let loanCount = entity.totalLoanCount;
    let loanAmount = amount.toBigDecimal();
    entity.totalLoanCount = loanCount + 1;
    entity.totalLoanVolume = entity.totalLoanVolume.plus(loanAmount);
    if (loanAmount.gt(entity.largestLoan)) {
      entity.largestLoan = loanAmount;
    }
    entity.averageLoanAmount = entity.totalLoanVolume.div(
      BigInt.fromI32(entity.totalLoanCount).toBigDecimal()
    );
    entity.totalPaidInterest = entity.totalPaidInterest.plus(interest);
    entity.save();
  }
}

declare type i32 = number;
export function updateProtocolFeeParameters(
  _protocol: Address,
  securityFee: number,
  protocolFee: number
): void {
  return;
  let entity = protocol.load(_protocol);
  if (entity) {
    let securityFeeBigInt = new BigInt(securityFee).toI32();
    let protocolFeeBigInt = new BigInt(protocolFee).toI32();
    entity.securityFee = securityFeeBigInt;
    entity.protocolFee = protocolFeeBigInt;
    entity.save();
  }
}

export function updateTxType(event: ethereum.Event, txType: string): string {
  let tx = transactions.log(event);
  tx.txType = txType;
  tx.save();
  return tx.id;
}
