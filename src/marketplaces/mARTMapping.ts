import { sale, transaction, currency, listedNft } from "../../generated/schema";

import { MatchTransferWithSale } from "../utils/matchTransferSale";

import {
  ItemListed,
  ItemSold,
} from '../../generated/Contract/Contract'

import { constants, ERC20Contracts} from "../graphprotocol-utils";

import { BigDecimal, Address } from "@graphprotocol/graph-ts";

// TakerAsk Handler starts here
export function handleItemSale(event: ItemSold): void {
  //1. load transaction
  let tx = transaction.load(event.transaction.hash.toHexString());

  //2. nullcheck transaction entity (one should already exist for the transfer earlier in that)
  if (tx) {
    //3. create new sale entity (id = tx hash - eventId)
    let saleEntity = sale.load(event.block.number.toString() + "-" + event.logIndex.toString());

    if (!saleEntity && tx.unmatchedTransferCount > 0) {
      // Assume default value of currency as phony ERC20
      let currencyAddress: Address = Address.fromString("0xf75150d730ce97c1551e97df39c0a049024e4c25"); //update to DAZ/WETH ERC20

      // If the transaction value is > 0 then assume the sale occurs in ETH
      if (event.transaction.value != constants.BIGINT_ZERO || event.params.price == constants.BIGINT_ONE) {currencyAddress = Address.fromString(constants.ADDRESS_ZERO)}

      ERC20Contracts.getERC20(currencyAddress)
      let currencyEntity = currency.load(currencyAddress.toHexString())

      if (currencyEntity) {
        //4. Assign currency address, amount, txId and platform to sale entity
        let saleEntity = new sale(event.block.number.toString() + "-" + event.logIndex.toString());
        saleEntity.transaction = tx.id;
        saleEntity.currency = currencyEntity.id;
        saleEntity.platform = "mART";
        saleEntity.amount = event.params.price.divDecimal(BigDecimal.fromString("1000000000000000000"));
        saleEntity.blockNumber = event.block.number.toI32();
        saleEntity.timestamp = event.block.timestamp.toI32();
        saleEntity.save();

        //5. Assign sale.amount / transaction.unmatchedTransferCount to variable transferAmount to pass into transfer entities
        // This will derives the amount per transfer (eg each nft's amount in a bundle with 2 NFT's is the total price divided by 2.)
        let transferAmount = saleEntity.amount.div(BigDecimal.fromString(tx.unmatchedTransferCount.toString()));
        //6. Using unmatchedTransferId loop through the transfer entities and apply the transferAmount and assign saleId ,
        //reducing the unmatchedTransferCount by 1. save transfer update on each loop.
        if (tx.transfers && transferAmount && tx.id && saleEntity.id) {
          let array = tx.transfers;
          for (let index = 0; index < array.length; index++) {
            let trId = array[index];

            MatchTransferWithSale(trId, transferAmount, tx.id, saleEntity.id, currencyEntity.symbol);
          }
        }
      }
    }
  }
}

// export function handleNewListing(event: ItemListed): void {
//   //1. load transaction
//   let tx = transaction.load(event.transaction.hash.toHexString());
  
//   //2. nullcheck transaction entity (one should already exist for the transfer earlier in that)
//   if (tx) {
//     //3. create new listing entity (id = tx hash - eventId)
//     let listingEntity = listedNft.load(event.block.number.toString() + "-" + event.logIndex.toString());
    
//     if (!listingEntity && tx.unmatchedTransferCount > 0) {
      
//       let currencyAddress: Address = Address.fromString("0xf75150d730ce97c1551e97df39c0a049024e4c25"); //update to DAZ/WETH ERC20

//       // If the transaction value is > 0 then assume the sale occurs in ETH
//       if (event.transaction.value != constants.BIGINT_ZERO || event.params.price == constants.BIGINT_ONE) {currencyAddress = Address.fromString(constants.ADDRESS_ZERO)}

//       ERC20Contracts.getERC20(currencyAddress)
//       let currencyEntity = currency.load(currencyAddress.toHexString())

//       if (currencyEntity) {
//         //4. Assign currency address, amount, txId and platform to sale entity
//         let listingEntity = new listedNft(event.block.number.toString() + "-" + event.logIndex.toString());
//         listingEntity.transaction = tx.id;
//         listingEntity.currency = currencyEntity.id;
//         listingEntity.platform = "mART";
//         listingEntity.price = event.params.price.divDecimal(BigDecimal.fromString("1000000000000000000"));
//         listingEntity.blockNumber = event.block.number.toI32();
//         listingEntity.timestamp = event.block.timestamp.toI32();
//         listingEntity.save();
//     }
    
//   }
//   }
// }