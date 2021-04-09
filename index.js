const ProperSkipList = require('proper-skip-list');
const LinkedList = require('linked-list');

class BigOrderBook {
  constructor(options) {
    this.options = options || {};
    this.orderItemMap = new Map();
    this.askList = new ProperSkipList({updateLength: false});
    this.bidList = new ProperSkipList({updateLength: false});
    this.askCount = 0;
    this.bidCount = 0;
    this.minPartialTakeValue = BigInt(this.options.minPartialTakeValue || 0);
    this.minPartialTakeSize = BigInt(this.options.minPartialTakeSize || 0);
    this.priceDecimalPrecision = this.options.priceDecimalPrecision == null ? 4 : this.options.priceDecimalPrecision;
    this.pricePrecisionFactor = 10 ** this.priceDecimalPrecision;
  }

  add(order) {
    if (order.side !== 'ask' && order.side !== 'bid') {
      throw new Error(
        `The order ${order.id} did not have a valid side property; it should be ask or bid`
      );
    }
    if (order.side === 'ask') {
      return this._addAsk(order);
    }
    return this._addBid(order);
  }

  has(orderId) {
    return this.orderItemMap.has(orderId);
  }

  get(orderId) {
    let item = this.orderItemMap.get(orderId);
    if (!item) {
      return undefined;
    }
    return item.order;
  }

  findBids(price) {
    let result = this.bidList.findEntries(price);
    return {
      asc: this._getSimpleOrderIterator(result.asc),
      desc: this._getSimpleOrderIterator(result.desc),
    }
  }

  findAsks(price) {
    let result = this.askList.findEntries(price);
    return {
      asc: this._getSimpleOrderIterator(result.asc),
      desc: this._getSimpleOrderIterator(result.desc),
    }
  }

  remove(orderId) {
    let orderItem = this.orderItemMap.get(orderId);

    if (!orderItem) {
      return undefined;
    }
    let priceOrderLinkedList = orderItem.list;
    let order = orderItem.order;
    orderItem.detach();

    if (order.side === 'ask') {
      this.askCount--;
      if (priceOrderLinkedList.size <= 0) {
        this.askList.delete(order.price);
      } else {
        priceOrderLinkedList.sizeRemaining -= order.sizeRemaining;
      }
    } else {
      this.bidCount--;
      if (priceOrderLinkedList.size <= 0) {
        this.bidList.delete(order.price);
      } else {
        priceOrderLinkedList.valueRemaining -= order.valueRemaining;
      }
    }
    this.orderItemMap.delete(orderId);
    return order;
  }

  getMaxAsk() {
    let priceOrderMap = this.askList.maxValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getMinAsk() {
    let priceOrderMap = this.askList.minValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getMaxBid() {
    let priceOrderMap = this.bidList.maxValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getMinBid() {
    let priceOrderMap = this.bidList.minValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getAskIteratorFromMin() {
    return this._getSimpleOrderIterator(this.askList.findEntriesFromMin());
  }

  getAskIteratorFromMax() {
    return this._getSimpleOrderIterator(this.askList.findEntriesFromMax());
  }

  getBidIteratorFromMin() {
    return this._getSimpleOrderIterator(this.bidList.findEntriesFromMin());
  }

  getBidIteratorFromMax() {
    return this._getSimpleOrderIterator(this.bidList.findEntriesFromMax());
  }

  getAskLevelIteratorFromMin() {
    return this._getAskPriceLevelIterator(this.askList.findEntriesFromMin());
  }

  getAskLevelIteratorFromMax() {
    return this._getAskPriceLevelIterator(this.askList.findEntriesFromMax());
  }

  getBidLevelIteratorFromMin() {
    return this._getBidPriceLevelIterator(this.bidList.findEntriesFromMin());
  }

  getBidLevelIteratorFromMax() {
    return this._getBidPriceLevelIterator(this.bidList.findEntriesFromMax());
  }

  clear() {
    this.askList.clear();
    this.bidList.clear();
    this.orderItemMap.clear();
    this.askCount = 0;
    this.bidCount = 0;
  }

  _convertSizeToValue(size, price) {
    return size * BigInt(Math.floor(price * this.pricePrecisionFactor)) / BigInt(this.pricePrecisionFactor);
  }

  _convertValueToSize(value, price) {
    return value * BigInt(this.pricePrecisionFactor) / BigInt(Math.floor(price * this.pricePrecisionFactor));
  }

  _addAsk(ask) {
    if (ask.value != null) {
      throw new Error(
        `The ask order with id ${ask.id} should not have a value property; it should have a size property instead`
      );
    }
    if (ask.size == null) {
      throw new Error(
        `The ask order with id ${ask.id} did not have a valid size property`
      );
    }
    if (this.has(ask.id)) {
      throw new Error(
        `The ask order with id ${ask.id} is already in the order book`
      );
    }
    if (ask.type === 'limit') {
      if (ask.price == null || ask.price <= 0) {
        throw new Error(
          `The limit ask order with id ${ask.id} did not have a valid price property`
        );
      }
      ask.price = Math.round(ask.price * this.pricePrecisionFactor) / this.pricePrecisionFactor;
    }
    if (ask.sizeRemaining == null) {
      ask.sizeRemaining = BigInt(ask.size);
    } else {
      ask.sizeRemaining = BigInt(ask.sizeRemaining);
    }
    if (ask.lastSizeTaken == null) {
      ask.lastSizeTaken = 0n;
    } else {
      ask.lastSizeTaken = BigInt(ask.lastSizeTaken);
    }
    if (ask.lastValueTaken == null) {
      ask.lastValueTaken = 0n;
    } else {
      ask.lastValueTaken = BigInt(ask.lastValueTaken);
    }

    let makers = [];
    let takeSize = 0n;
    let takeValue = 0n;
    let highestBid = this.getMaxBid();
    if (
      ask.type === 'limit' &&
      (!highestBid || ask.price > highestBid.price)
    ) {
      this._insertAsk(ask);
    } else {
      let iterator = this.bidList.findEntriesFromMax();
      let deleteRangeMin;
      let deleteRangeMax;
      for (let [currentBidPrice, priceOrderLinkedList] of iterator) {
        if (
          (ask.type === 'limit' && ask.price > currentBidPrice) ||
          ask.sizeRemaining <= 0n
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentBid = currentItem.order;
          if (ask.sizeRemaining <= 0n) {
            break;
          }
          let askValueRemaining = this._convertSizeToValue(ask.sizeRemaining, currentBid.price);
          if (askValueRemaining >= currentBid.valueRemaining) {
            let currentBidSizeRemaining = this._convertValueToSize(currentBid.valueRemaining, currentBid.price);
            ask.sizeRemaining -= currentBidSizeRemaining;
            currentBid.lastSizeTaken = currentBidSizeRemaining;
            currentBid.lastValueTaken = currentBid.valueRemaining;
            currentBid.valueRemaining = 0n;
            if (currentItem.list.size <= 1) {
              if (deleteRangeMax == null) {
                deleteRangeMax = currentBidPrice;
              }
              deleteRangeMin = currentBidPrice;
            }
            currentItem.detach();
            this.bidCount--;
            takeSize += this._convertValueToSize(currentBid.lastValueTaken, currentBid.price);
            takeValue += currentBid.lastValueTaken;
            priceOrderLinkedList.valueRemaining -= currentBid.lastValueTaken;
            makers.push(currentBid);
          } else {
            // Only take a portion from the maker if the remaining value is greater than the minimum take value.
            if (askValueRemaining >= this.minPartialTakeValue) {
              currentBid.lastSizeTaken = ask.sizeRemaining;
              currentBid.lastValueTaken = askValueRemaining;
              currentBid.valueRemaining -= askValueRemaining;
              takeSize += this._convertValueToSize(currentBid.lastValueTaken, currentBid.price);
              takeValue += currentBid.lastValueTaken;
              priceOrderLinkedList.valueRemaining -= currentBid.lastValueTaken;
              makers.push(currentBid);
            }
            ask.sizeRemaining = 0n;
          }
          currentItem = nextItem;
        }
      }
      if (deleteRangeMin != null) {
        this.bidList.deleteRange(deleteRangeMin, deleteRangeMax, true, true);
      }
      if (ask.type === 'limit' && ask.sizeRemaining > 0n) {
        this._insertAsk(ask);
      }
    }
    return {
      taker: {...ask},
      makers: makers.map(maker => ({...maker})),
      takeSize,
      takeValue
    };
  }

  _insertAsk(order) {
    let priceOrderLinkedList = this.askList.find(order.price);
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.askList.upsert(order.price, priceOrderLinkedList);
      priceOrderLinkedList.sizeRemaining = 0n;
    }
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    priceOrderLinkedList.sizeRemaining += order.sizeRemaining;
    this.orderItemMap.set(order.id, newItem);
    this.askCount++;
  }

  _addBid(bid) {
    if (bid.size != null) {
      throw new Error(
        `The bid order with id ${bid.id} should not have a size property; it should have a value property instead`
      );
    }
    if (bid.value == null) {
      throw new Error(
        `The bid order with id ${bid.id} did not have a valid value property`
      );
    }
    if (this.has(bid.id)) {
      throw new Error(
        `The bid order with id ${bid.id} is already in the order book`
      );
    }
    if (bid.type === 'limit') {
      if (bid.price == null || bid.price <= 0) {
        throw new Error(
          `The limit bid order with id ${bid.id} did not have a valid price property`
        );
      }
      bid.price = Math.round(bid.price * this.pricePrecisionFactor) / this.pricePrecisionFactor;
    }
    if (bid.valueRemaining == null) {
      bid.valueRemaining = BigInt(bid.value);
    } else {
      bid.valueRemaining = BigInt(bid.valueRemaining);
    }
    if (bid.lastSizeTaken == null) {
      bid.lastSizeTaken = 0n;
    } else {
      bid.lastSizeTaken = BigInt(bid.lastSizeTaken);
    }
    if (bid.lastValueTaken == null) {
      bid.lastValueTaken = 0n;
    } else {
      bid.lastValueTaken = BigInt(bid.lastValueTaken);
    }

    let makers = [];
    let takeSize = 0n;
    let takeValue = 0n;
    let lowestAsk = this.getMinAsk();
    if (
      bid.type === 'limit' &&
      (!lowestAsk || bid.price < lowestAsk.price)
    ) {
      this._insertBid(bid);
    } else {
      let iterator = this.askList.findEntriesFromMin();
      let deleteRangeMin;
      let deleteRangeMax;
      for (let [currentAskPrice, priceOrderLinkedList] of iterator) {
        if (
          (bid.type === 'limit' && bid.price < currentAskPrice) ||
          bid.valueRemaining <= 0n
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentAsk = currentItem.order;
          if (bid.valueRemaining <= 0n) {
            break;
          }
          let bidSizeRemaining = this._convertValueToSize(bid.valueRemaining, currentAsk.price);
          if (bidSizeRemaining >= currentAsk.sizeRemaining) {
            let currentAskValueRemaining = this._convertSizeToValue(currentAsk.sizeRemaining, currentAsk.price);
            bid.valueRemaining -= currentAskValueRemaining;
            currentAsk.lastSizeTaken = currentAsk.sizeRemaining;
            currentAsk.lastValueTaken = currentAskValueRemaining;
            currentAsk.sizeRemaining = 0n;
            if (currentItem.list.size <= 1) {
              if (deleteRangeMin == null) {
                deleteRangeMin = currentAskPrice;
              }
              deleteRangeMax = currentAskPrice;
            }
            currentItem.detach();
            this.askCount--;
            takeSize += currentAsk.lastSizeTaken;
            takeValue += this._convertSizeToValue(currentAsk.lastSizeTaken, currentAsk.price);
            priceOrderLinkedList.sizeRemaining -= currentAsk.lastSizeTaken;
            makers.push(currentAsk);
          } else {
            // Only take a portion from the maker if the remaining size is greater than the minimum take size.
            if (bidSizeRemaining >= this.minPartialTakeSize) {
              currentAsk.lastSizeTaken = bidSizeRemaining;
              currentAsk.lastValueTaken = bid.valueRemaining;
              currentAsk.sizeRemaining -= bidSizeRemaining;
              takeSize += currentAsk.lastSizeTaken;
              takeValue += this._convertSizeToValue(currentAsk.lastSizeTaken, currentAsk.price);
              priceOrderLinkedList.sizeRemaining -= currentAsk.lastSizeTaken;
              makers.push(currentAsk);
            }
            bid.valueRemaining = 0n;
          }
          currentItem = nextItem;
        }
      }
      if (deleteRangeMin != null) {
        this.askList.deleteRange(deleteRangeMin, deleteRangeMax, true, true);
      }
      if (bid.type === 'limit' && bid.valueRemaining > 0n) {
        this._insertBid(bid);
      }
    }
    return {
      taker: {...bid},
      makers: makers.map(maker => ({...maker})),
      takeSize,
      takeValue
    };
  }

  _insertBid(order) {
    let priceOrderLinkedList = this.bidList.find(order.price);
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.bidList.upsert(order.price, priceOrderLinkedList);
      priceOrderLinkedList.valueRemaining = 0n;
    }
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    priceOrderLinkedList.valueRemaining += order.valueRemaining;
    this.orderItemMap.set(order.id, newItem);
    this.bidCount++;
  }

  _getSimpleOrderIterator(orderListIterator) {
    let {value: startValue} = orderListIterator.next();
    let [key, priceOrderLinkedList] = startValue;
    let currentItem = priceOrderLinkedList == null ? undefined : priceOrderLinkedList.head;
    return {
      next: function () {
        if (!currentItem) {
          return {
            value: undefined,
            done: true
          };
        }
        let currentOrder = currentItem.order;
        currentItem = currentItem.next;
        if (!currentItem) {
          let {value, done} = orderListIterator.next();
          let [currentKey, currentPriceOrderLinkedList] = value;
          currentItem = currentPriceOrderLinkedList == null ? undefined : currentPriceOrderLinkedList.head;
        }
        return {
          value: currentOrder,
          done: false
        };
      },
      [Symbol.iterator]: function () { return this; }
    };
  }

  _getAskPriceLevelIterator(orderListIterator) {
    return {
      next: function () {
        let {value, done} = orderListIterator.next();
        let [price, priceOrderLinkedList] = value;
        let result;
        if (priceOrderLinkedList == null) {
          result = undefined;
        } else {
          result = {
            price,
            sizeRemaining: priceOrderLinkedList.sizeRemaining
          };
        }
        return {
          value: result,
          done
        };
      },
      [Symbol.iterator]: function () { return this; }
    };
  }

  _getBidPriceLevelIterator(orderListIterator) {
    return {
      next: function () {
        let {value, done} = orderListIterator.next();
        let [price, priceOrderLinkedList] = value;
        let result;
        if (priceOrderLinkedList == null) {
          result = undefined;
        } else {
          result = {
            price,
            valueRemaining: priceOrderLinkedList.valueRemaining
          };
        }
        return {
          value: result,
          done
        };
      },
      [Symbol.iterator]: function () { return this; }
    };
  }
}

module.exports = BigOrderBook;
