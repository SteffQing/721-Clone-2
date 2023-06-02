import {
  account,
  transfer,
  transaction,
  accountCollection,
} from "../../generated/schema";

import { Transfer as TransferEvent } from "../../generated/IERC721/IERC721";

import { fetchAccount, fetchRegistry, fetchToken } from "../utils/erc721";

import { constants, events, transactions } from "../graphprotcol-utls";

import { store, BigInt } from "@graphprotocol/graph-ts";

export function handleTransfer(event: TransferEvent): void {
  let collection = fetchRegistry(event.address);
  if (collection != null) {
    let timestampBigInt = BigInt.fromI32(event.block.timestamp.toI32());
    let token = fetchToken(collection, event.params.tokenId, timestampBigInt);

    let senderAddress = account.load(event.params.from);
    if (!senderAddress) {
      senderAddress = fetchAccount(event.params.from);
    }

    let receiverAddress = account.load(event.params.to);
    if (!receiverAddress) {
      receiverAddress = fetchAccount(event.params.to);
    }

    let senderAccountCollection = accountCollection.load(
      senderAddress.id.toHexString() + "-" + collection.id.toHexString()
    );
    if (
      senderAccountCollection &&
      senderAddress.id.toHexString() !=
        "0x0000000000000000000000000000000000000000"
    ) {
      let senderTokenCountNew = senderAccountCollection.tokenCount - 1;

      senderAccountCollection.tokenCount = senderTokenCountNew;
      senderAccountCollection.save();

      if (senderAccountCollection.tokenCount == 0) {
        store.remove(
          "accountCollection",
          senderAddress.id.toHexString() + "-" + collection.id.toHexString()
        );
      }
    }

    let receiverAccountCollection = accountCollection.load(
      receiverAddress.id.toHexString() + "-" + collection.id.toHexString()
    );
    if (
      receiverAccountCollection &&
      receiverAddress.id.toHexString() !=
        "0x0000000000000000000000000000000000000000"
    ) {
      let receiverTokenCountNew = receiverAccountCollection.tokenCount + 1;

      receiverAccountCollection.tokenCount = receiverTokenCountNew;
      receiverAccountCollection.save();
    }
    if (
      !receiverAccountCollection &&
      receiverAddress.id.toHexString() !=
        "0x0000000000000000000000000000000000000000"
    ) {
      receiverAccountCollection = new accountCollection(
        receiverAddress.id.toHexString() + "-" + collection.id.toHexString()
      );
      receiverAccountCollection.account = receiverAddress.id;
      receiverAccountCollection.collection = collection.id;
      receiverAccountCollection.tokenCount = 1;

      receiverAccountCollection.save();
    }
    token.owner = receiverAddress.id;

    collection.save();
    token.save();
    senderAddress.save();
    receiverAddress.save();

    let transferEntity = new transfer(events.id(event));
    transferEntity.transaction = transactions.log(event).id;
    transferEntity.token = token.id;
    transferEntity.collection = collection.id;
    transferEntity.senderAddress = senderAddress.id;
    transferEntity.receiverAddress = receiverAddress.id;
    transferEntity.blockNumber = event.block.number.toI32();
    transferEntity.timestamp = event.block.timestamp.toI32();
    transferEntity.save();

    let tx = transaction.load(event.transaction.hash.toHexString());
    if (tx != null) {
      let transferArray = tx.transfers;
      transferArray.push(transferEntity.id);
      
      tx.transfers = transferArray;
      tx.save();
    }
  }
}
