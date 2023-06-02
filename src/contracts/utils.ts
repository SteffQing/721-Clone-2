import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { transaction } from "../../generated/schema";
import { ItemSold as ItemSoldEvent } from "../../generated/Marketplace/Marketplace";
import { CollectionOfferAccepted as CollectionOfferAcceptedEvent } from "../../generated/Offers/Offers";
import { BidAccepted as BidAcceptedEvent } from "../../generated/Auction/Auction";
import { TokenOfferAccepted as TokenOfferAcceptedEvent } from "../../generated/Offers/Offers";
import { sale } from "../../generated/schema";
import { MatchTransferWithSale } from "../utils/matchTransferSale";

function utils(
  tx: transaction,
  blockNumber: BigInt,
  logIndex: string,
  price: BigInt
): void {
  //3. create new sale entity (id = tx hash - eventId)
  let saleEntity = sale.load(
    blockNumber.toString() + "-" + logIndex.toString()
  );
  if (!saleEntity && tx.unmatchedTransferCount > 0) {
    //4. Assign currency address, amount, txId and platform to sale entity
    let saleEntity = new sale(
      blockNumber.toString() + "-" + logIndex.toString()
    );
    saleEntity.transaction = tx.id;

    saleEntity.amount = price.divDecimal(
      BigDecimal.fromString("1000000000000000000")
    );
    saleEntity.save();

    //5. Assign sale.amount / transaction.unmatchedTransferCount to variable transferAmount to pass into transfer entities
    // This will derives the amount per transfer (eg each nft's amount in a bundle with 2 NFT's is the total price divided by 2.)
    let transferAmount = saleEntity.amount.div(
      BigDecimal.fromString(tx.unmatchedTransferCount.toString())
    );

    //6. Using unmatchedTransferId loop through the transfer entities and apply the transferAmount and assign saleId ,
    //reducing the unmatchedTransferCount by 1. save transfer update on each loop.
    if (tx.transfers && transferAmount && tx.id && saleEntity.id) {
      let array = tx.transfers;
      for (let index = 0; index < array.length; index++) {
        let trId = array[index];

        MatchTransferWithSale(trId, transferAmount, tx.id, saleEntity.id);
      }
    }
  }
}

export function updateSalesData(event: ItemSoldEvent): void {
  let tx = transaction.load(event.transaction.hash.toHexString());
  if (tx) {
    utils(
      tx,
      event.block.number,
      event.logIndex.toString(),
      event.params.price
    );
  }
}
export function updateCollectionOffer(
  event: CollectionOfferAcceptedEvent
): void {
  let tx = transaction.load(event.transaction.hash.toHexString());
  if (tx) {
    utils(
      tx,
      event.block.number,
      event.logIndex.toString(),
      event.params.value
    );
  }
}
export function updateAuction(event: BidAcceptedEvent): void {
  let tx = transaction.load(event.transaction.hash.toHexString());
  if (tx) {
    utils(
      tx,
      event.block.number,
      event.logIndex.toString(),
      event.params.amount
    );
  }
}
export function updateTokenOffer(event: TokenOfferAcceptedEvent): void {
  let tx = transaction.load(event.transaction.hash.toHexString());
  if (tx) {
    utils(
      tx,
      event.block.number,
      event.logIndex.toString(),
      event.params.value
    );
  }
}
