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

    let senderAddress = account.load(event.params.from.toHexString());
    if (!senderAddress) {
      senderAddress = fetchAccount(event.params.from);
    }

    let receiverAddress = account.load(event.params.to.toHexString());
    if (!receiverAddress) {
      receiverAddress = fetchAccount(event.params.to);
    }

    let senderAccountCollection = accountCollection.load(
      senderAddress.id + "-" + collection.id
    );
    if (
      senderAccountCollection &&
      senderAddress.id != "0x0000000000000000000000000000000000000000"
    ) {
      let senderTokenCountNew = senderAccountCollection.tokenCount - 1;

      senderAccountCollection.tokenCount = senderTokenCountNew;
      senderAccountCollection.save();

      if (senderAccountCollection.tokenCount == 0) {
        store.remove(
          "accountCollection",
          senderAddress.id + "-" + collection.id
        );
      }
    }

    let receiverAccountCollection = accountCollection.load(
      receiverAddress.id + "-" + collection.id
    );
    if (
      receiverAccountCollection &&
      receiverAddress.id != "0x0000000000000000000000000000000000000000"
    ) {
      let receiverTokenCountNew = receiverAccountCollection.tokenCount + 1;

      receiverAccountCollection.tokenCount = receiverTokenCountNew;
      receiverAccountCollection.save();
    }
    if (
      !receiverAccountCollection &&
      receiverAddress.id != "0x0000000000000000000000000000000000000000"
    ) {
      receiverAccountCollection = new accountCollection(
        receiverAddress.id + "-" + collection.id
      );
      receiverAccountCollection.account = receiverAddress.id;
      receiverAccountCollection.collection = collection.id;
      receiverAccountCollection.tokenCount = 1;

      receiverAccountCollection.save();
    }
    if (receiverAddress.id == constants.Auction.toLowerCase()) {
      token.owner = senderAddress.id;
    } else {
      token.owner = receiverAddress.id;
    }

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
    transferEntity.amount = constants.BIGDECIMAL_ZERO;
    transferEntity.save();

    let tx = transaction.load(event.transaction.hash.toHexString());
    if (tx != null) {
      let transferArray = tx.transfers;
      transferArray.push(transferEntity.id);

      let newTransferCount = tx.unmatchedTransferCount + 1;
      tx.unmatchedTransferCount = newTransferCount;
      tx.transfers = transferArray;
      tx.txType = "TRANSFER";
      tx.save();
    }
  }
}
