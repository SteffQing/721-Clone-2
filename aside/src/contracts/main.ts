import { BigInt, store, Address } from "@graphprotocol/graph-ts";
import {
  CollectionAdded as CollectionAddedEvent,
  CollectionRemoved as CollectionRemovedEvent,
  ProtocolCreated as ProtocolCreatedEvent,
} from "../../generated/MainContract/Main";
import { SupportedCollection, protocol } from "../../generated/schema";
import { constants } from "../graphprotcol-utls";

export function handleCollectionAddition(event: CollectionAddedEvent): void {
  let collectionAddress = event.params._collection;
  let address = collectionAddress.toHexString();
  let entity = new SupportedCollection("nftLending/".concat(address));
  entity.collection = collectionAddress;
  entity.save();
}
export function handleCollectionRemoval(event: CollectionRemovedEvent): void {
  let collectionAddress = event.params._collection;
  let address = collectionAddress.toHexString();
  let entity = SupportedCollection.load("nftLending/".concat(address));
  if (entity) {
    store.remove("SupportedCollection", entity.id);
  }
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
