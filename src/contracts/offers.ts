import { BigInt, store } from "@graphprotocol/graph-ts";
import {
  collectionOffer,
  collectionTokenOffer,
  collection,
  saleInfo,
} from "../../generated/schema";
import {
  CollectionOfferAccepted as CollectionOfferAcceptedEvent,
  CollectionOfferCreated as CollectionOfferCreatedEvent,
  CollectionOfferDeleted as CollectionOfferDeletedEvent,
  TokenOfferAccepted as TokenOfferAcceptedEvent,
  TokenOfferCancelled as TokenOfferCancelledEvent,
  TokenOfferCreated as TokenOfferCreatedEvent,
  TokenOfferUpdated as TokenOfferUpdatedEvent,
} from "../../generated/Offers/Offers";
import {
  fetchAccount,
  fetchAccountStatistics,
  fetchRegistry,
  fetchToken,
} from "../utils/erc721";
import { updateCollectionOffer, updateTokenOffer } from "./utils";
import { clearSaleInfo, updateTxType } from "./marketplace";

export function handleCollectionOfferAccepted(
  event: CollectionOfferAcceptedEvent
): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId;
  let creator = event.params.creator;
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId.toString());
  let entity = collectionOffer.load(
    collectionAddress.concat("/").concat(creator.toHexString())
  );
  let creatorEntity = fetchAccountStatistics(fetchAccount(creator).id);
  creatorEntity.points = creatorEntity.points + 20;
  creatorEntity.salesVolume = creatorEntity.salesVolume.plus(
    event.params.value
  );
  creatorEntity.save();
  let sellerEntity = fetchAccountStatistics(
    fetchAccount(event.params.seller).id
  );
  sellerEntity.points = sellerEntity.points + 10;
  sellerEntity.totalSales = sellerEntity.totalSales + 1;
  sellerEntity.save();

  if (entity != null) {
    let saleInfoEntity = saleInfo.load(tokenEntityId);
    if (saleInfoEntity == null) {
      saleInfoEntity = new saleInfo(tokenEntityId);
      saleInfoEntity.token = tokenEntityId;
      saleInfoEntity.collection = collectionAddress;
      saleInfoEntity.state = "NONE";
      saleInfoEntity.timestamp = event.block.timestamp.toI32();
    }
    clearSaleInfo(saleInfoEntity);
    saleInfoEntity.save();
    let collectionEntity = collection.load(collectionAddress);
    if (collectionEntity != null) {
      collectionEntity.valueLocked = collectionEntity.valueLocked.minus(
        event.params.value
      );
      collectionEntity.save();
    }
    updateCollectionOffer(event);
    entity.amount = entity.amount.minus(event.params.value);
    entity.total = entity.total - 1;
    updateTxType(event, "COLLECTION_OFFER_ACCEPTED", tokenEntityId);
    if (entity.total === 0) {
      store.remove("collectionOffer", entity.id);
    } else {
      entity.save();
    }
  }
}

export function handleCollectionOfferCreated(
  event: CollectionOfferCreatedEvent
): void {
  let collectionEntity = fetchRegistry(event.params.collection);
  let creator = event.params.creator;
  let entity = new collectionOffer(
    collectionEntity.id.concat("/").concat(creator.toHexString())
  );
  let creatorEntity = fetchAccountStatistics(fetchAccount(creator).id);
  collectionEntity.valueLocked = collectionEntity.valueLocked.plus(
    event.params.value
  );
  collectionEntity.save();

  entity.creator = creatorEntity.id.toHexString();
  entity.collection = collectionEntity.id;
  entity.amount = event.params.value;
  entity.total = event.params.total.toI32();
  entity.validity = event.params.validity;

  entity.save();
}

export function handleCollectionOfferDeleted(
  event: CollectionOfferDeletedEvent
): void {
  let collectionAddress = event.params.collection.toHex();
  let creator = event.params.creator.toHexString();
  let entity = collectionOffer.load(
    collectionAddress.concat("/").concat(creator)
  );
  if (entity != null) {
    let collectionEntity = collection.load(collectionAddress);
    if (collectionEntity != null) {
      collectionEntity.valueLocked = collectionEntity.valueLocked.minus(
        event.params.value
      );
      collectionEntity.save();
    }
    store.remove("collectionOffer", entity.id);
  }
}

export function handleTokenOfferAccepted(event: TokenOfferAcceptedEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.token.toString();
  let creator = event.params.creator.toHexString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let id = tokenEntityId.concat("/").concat(creator);
  let entity = collectionTokenOffer.load(id);
  if (entity != null) {
    let collectionEntity = fetchRegistry(event.params.collection);
    collectionEntity.valueLocked = collectionEntity.valueLocked.minus(
      event.params.value
    );
    updateTokenOffer(event);
    let creatorEntity = fetchAccountStatistics(creator);
    creatorEntity.points = creatorEntity.points + 20;
    creatorEntity.salesVolume = creatorEntity.salesVolume.plus(
      event.params.value
    );

    let sellerEntity = fetchAccountStatistics(
      event.params.seller.toHexString()
    );
    sellerEntity.points = sellerEntity.points + 10;
    sellerEntity.totalSales = sellerEntity.totalSales + 1;
    let saleInfoEntity = saleInfo.load(tokenEntityId);
    if (saleInfoEntity == null) {
      saleInfoEntity = new saleInfo(tokenEntityId);
      saleInfoEntity.token = tokenEntityId;
      saleInfoEntity.collection = collectionAddress;
      saleInfoEntity.state = "NONE";
      saleInfoEntity.timestamp = event.block.timestamp.toI32();
    }
    clearSaleInfo(saleInfoEntity);
    updateTxType(event, "TOKEN_OFFER_ACCEPTED", tokenEntityId);
    saleInfoEntity.save();
    sellerEntity.save();
    creatorEntity.save();
    collectionEntity.save();

    store.remove("collectionTokenOffer", id);
  }
}

export function handleTokenOfferCancelled(
  event: TokenOfferCancelledEvent
): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let id = tokenEntityId.concat("/").concat(event.params.creator.toHex());
  let entity = collectionTokenOffer.load(id);
  if (entity != null) {
    let value = entity.value;
    let collectionEntity = collection.load(collectionAddress);
    if (collectionEntity != null) {
      collectionEntity.valueLocked = collectionEntity.valueLocked.minus(value);
      collectionEntity.save();
    }
    updateTxType(event, "TOKEN_OFFER_DELETED", tokenEntityId);
    store.remove("collectionTokenOffer", id);
  }
}

export function handleTokenOfferCreated(event: TokenOfferCreatedEvent): void {
  let collectionEntity = fetchRegistry(event.params.collection);

  let timestampBigInt = BigInt.fromI32(event.block.timestamp.toI32());
  let TOKEN = fetchToken(
    collectionEntity,
    event.params.tokenId,
    timestampBigInt
  );

  let entityId = TOKEN.id.concat("/").concat(event.params.creator.toHex());

  collectionEntity.valueLocked = collectionEntity.valueLocked.plus(
    event.params.value
  );
  collectionEntity.save();

  let entity = new collectionTokenOffer(entityId);
  entity.collection = collectionEntity.id;
  entity.token = TOKEN.id;
  entity.creator = event.params.creator.toHex();
  entity.value = event.params.value;
  entity.validity = event.params.validity;

  updateTxType(event, "TOKEN_OFFER_CREATED", TOKEN.id);

  entity.save();
}

export function handleTokenOfferUpdated(event: TokenOfferUpdatedEvent): void {
  let collectionAddress = event.params.collection.toHex();
  let tokenId = event.params.tokenId.toString();
  let tokenEntityId = "kcc/"
    .concat(collectionAddress)
    .concat("/")
    .concat(tokenId);
  let id = tokenEntityId.concat("/").concat(event.params.creator.toHex());
  let entity = collectionTokenOffer.load(id);
  if (entity != null) {
    let collectionEntity = collection.load(collectionAddress);
    let newTokenOfferValue = event.params.value.minus(entity.value);
    if (collectionEntity != null) {
      collectionEntity.valueLocked = collectionEntity.valueLocked.plus(
        newTokenOfferValue
      );
      collectionEntity.save();
    }
    entity.value = event.params.value;
    entity.validity = event.params.validity;
    updateTxType(event, "TOKEN_OFFER_UPDATED", tokenEntityId);
    entity.save();
  }
}
