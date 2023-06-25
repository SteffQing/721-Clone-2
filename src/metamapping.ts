import {
  json,
  Bytes,
  dataSource,
  JSONValue,
  JSONValueKind,
} from "@graphprotocol/graph-ts";
import { TokenAttribute, TokenMetadata } from "../generated/schema";

export function handleMetadata(content: Bytes): void {
  let tokenMetadata = new TokenMetadata(dataSource.stringParam());

  const contentValue = json.try_fromBytes(content);
  if (contentValue.isOk) {
    const value = contentValue.value.toObject();
    if (value) {
      const image = value.get("image");
      const name = value.get("name");
      const description = value.get("description");
      if (name && image && description) {
        tokenMetadata.name = name.toString();
        tokenMetadata.image = image.toString();
        tokenMetadata.description = description.toString();
      }
      const attributes = value.get("attributes");
      if (attributes) {
        let attributeArray = attributes.toArray();
        setAttributes(attributeArray);
      }
      tokenMetadata.save();
    }
  }
}

function setAttributes(attributeArray: JSONValue[]): void {
  let length: number = attributeArray.length;
  for (let i = 0; i < length; i++) {
    let tokenAttributeEntityId = dataSource
      .stringParam()
      .concat("-attribute")
      .concat(i.toString());
    let tokenAttributeEntity = new TokenAttribute(tokenAttributeEntityId);
    let attributeObject = attributeArray[i].toObject();
    let try_traitType = attributeObject.get("trait_type");
    if (try_traitType == null) {
      try_traitType = attributeObject.get("traitType");
      if (try_traitType == null) {
        try_traitType = attributeObject.get("trait-type");
      }
    }
    let try_value = attributeObject.get("value");
    if (try_value && try_traitType) {
      tokenAttributeEntity.metadata = dataSource.stringParam();
      tokenAttributeEntity.traitType = try_traitType.toString();
      if (try_value.kind == JSONValueKind.STRING) {
        tokenAttributeEntity.value = try_value.toString();
      }
      if (try_value.kind == JSONValueKind.NUMBER) {
        tokenAttributeEntity.value = try_value.toI64().toString();
      }
      if (try_value.kind == JSONValueKind.BOOL) {
        tokenAttributeEntity.value = try_value.toBool().toString();
      }
      tokenAttributeEntity.save();
    }
  }
}
