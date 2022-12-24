import { Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/IERC721/ERC20";

import {
    transaction,
	wethTransaction
} from '../../generated/schema'



export function handleTransfer(event: Transfer): void {

    let wethTest = wethTransaction.load(event.transaction.hash.toHexString())
    
    if (event.transaction.to == Address.fromString('0xa9eba0cc148fc3ab7e9863cdb6907cecbd8b1dad')) {
        if (!wethTest) {
            
            let wethEntity = new wethTransaction(event.transaction.hash.toHexString())

            wethEntity.save()
        
        }
    }
}


